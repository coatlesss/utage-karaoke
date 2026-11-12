// UTAGE.exe: serves this folder on 127.0.0.1:47913, runs vocal separation for the app, and opens it in an Edge app window
// with its own profile. Exits (and stops serving) when that window closes.
// Build (C# 5, compiler ships with Windows):
//   C:\Windows\Microsoft.NET\Framework64\v4.0.30319\csc.exe /nologo /target:winexe /win32icon:utage.ico /out:UTAGE.exe UTAGE.cs
using System;
using System.Diagnostics;
using System.IO;
using System.Net;
using System.Net.Sockets;
using System.Text;
using System.Threading;
using System.Threading.Tasks;
using System.Windows.Forms;

static class Program
{
    // Fixed: the browser keys the song library and mic permission to this origin. (8765 is AnkiConnect's.)
    const int Port = 47913;
    static readonly string Root = AppDomain.CurrentDomain.BaseDirectory;
    static readonly string Url = "http://127.0.0.1:" + Port + "/";
    static readonly string SepRoot = Path.Combine(Path.GetTempPath(), "utage-sep");
    static readonly object SepLock = new object(); // one separation at a time (GPU memory)

    static void Main()
    {
        TcpListener listener = new TcpListener(IPAddress.Loopback, Port);
        try { listener.Start(); }
        catch (SocketException)
        {
            if (IsUtageRunning()) { OpenWindow(); return; } // already running: just open another window
            MessageBox.Show("Port " + Port + " is used by another program. Close it and try again.", "UTAGE");
            return;
        }
        new Thread(() => Serve(listener)) { IsBackground = true }.Start();
        Process app = OpenWindow();
        if (app != null) app.WaitForExit();
        try { if (Directory.Exists(SepRoot)) Directory.Delete(SepRoot, true); } catch (Exception) { }
    }

    static Process OpenWindow()
    {
        string edge = FindEdge();
        if (edge == null) { MessageBox.Show("UTAGE needs Microsoft Edge.", "UTAGE"); return null; }
        string profile = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), @"Utage\edge");
        return Process.Start(edge, "--app=" + Url + " --user-data-dir=\"" + profile + "\" --no-first-run --no-default-browser-check --window-size=1366,800");
    }

    static string FindEdge()
    {
        foreach (string pf in new[] { Environment.GetEnvironmentVariable("ProgramFiles(x86)"), Environment.GetEnvironmentVariable("ProgramFiles") })
        {
            if (pf == null) continue;
            string p = Path.Combine(pf, @"Microsoft\Edge\Application\msedge.exe");
            if (File.Exists(p)) return p;
        }
        return null;
    }

    static bool IsUtageRunning()
    {
        try { using (WebClient c = new WebClient()) return c.DownloadString(Url).Contains("UTAGE"); }
        catch (WebException) { return false; }
    }

    static void Serve(TcpListener listener)
    {
        while (true)
        {
            TcpClient client = listener.AcceptTcpClient();
            ThreadPool.QueueUserWorkItem(_ => Handle(client));
        }
    }

    // Minimal HTTP: GET/HEAD files in this folder, GET/POST /api/separate, GET /api/sep/<id>/<stem>.wav.
    static void Handle(TcpClient client)
    {
        using (client)
        using (NetworkStream s = client.GetStream())
        {
            try
            {
                string head = ReadHead(s);
                if (head == null) return;
                string[] lines = head.Split(new[] { "\r\n" }, StringSplitOptions.None), parts = lines[0].Split(' ');
                string method = parts[0], path = parts.Length > 1 ? parts[1] : "/";
                long length = 0;
                foreach (string l in lines)
                    if (l.StartsWith("Content-Length:", StringComparison.OrdinalIgnoreCase)) length = long.Parse(l.Substring(15).Trim());
                int cut = path.IndexOfAny(new[] { '?', '#' });
                if (cut >= 0) path = path.Substring(0, cut);
                path = Uri.UnescapeDataString(path);
                if (path == "/api/separate")
                {
                    if (method == "POST") Separate(s, ReadBody(s, length));
                    else if (PythonPath() != null) Reply(s, "200 OK", "text/plain; charset=utf-8", Encoding.UTF8.GetBytes("ready"), method);
                    else Reply(s, "404 Not Found", "text/plain; charset=utf-8", Encoding.UTF8.GetBytes("not installed"), method);
                    return;
                }
                if (path.StartsWith("/api/sep/")) { ServeFile(s, SepRoot, path.Substring(9), method); return; }
                ServeFile(s, Root, path == "/" ? "index.html" : path.TrimStart('/'), method);
            }
            catch (Exception) { } // malformed request or the browser hung up: drop the connection
        }
    }

    static string ReadHead(Stream s) // bytes up to the blank line; the body (if any) stays in the stream
    {
        MemoryStream m = new MemoryStream();
        int b, state = 0; // progress through \r\n\r\n
        while ((b = s.ReadByte()) != -1)
        {
            m.WriteByte((byte)b);
            if (b == '\r') state = state == 0 || state == 2 ? state + 1 : 1;
            else if (b == '\n') state = state == 1 || state == 3 ? state + 1 : 0;
            else state = 0;
            if (state == 4) return Encoding.ASCII.GetString(m.ToArray(), 0, (int)m.Length - 4);
            if (m.Length > 65536) return null;
        }
        return null;
    }

    static byte[] ReadBody(Stream s, long length)
    {
        if (length <= 0 || length > (1L << 30)) throw new InvalidDataException("bad Content-Length");
        byte[] body = new byte[length];
        int got = 0;
        while (got < length)
        {
            int n = s.Read(body, got, (int)Math.Min(length - got, 1 << 20));
            if (n <= 0) throw new EndOfStreamException();
            got += n;
        }
        return body;
    }

    static void ServeFile(Stream s, string root, string rel, string method)
    {
        string baseDir = Path.GetFullPath(root).TrimEnd('\\') + "\\";
        string full = Path.GetFullPath(Path.Combine(baseDir, rel.Replace('/', '\\')));
        if (!full.StartsWith(baseDir, StringComparison.OrdinalIgnoreCase) || !File.Exists(full))
            Reply(s, "404 Not Found", "text/plain; charset=utf-8", Encoding.UTF8.GetBytes("Not found"), method);
        else Reply(s, "200 OK", TypeOf(full), File.ReadAllBytes(full), method);
    }

    static void Reply(Stream s, string status, string type, byte[] body, string method)
    {
        byte[] head = Encoding.ASCII.GetBytes("HTTP/1.1 " + status + "\r\nContent-Type: " + type + "\r\nContent-Length: " + body.Length +
            "\r\nCache-Control: no-cache\r\nConnection: close\r\n\r\n");
        s.Write(head, 0, head.Length);
        if (method != "HEAD") s.Write(body, 0, body.Length);
    }

    // ---------- vocal separation: tools\separate.py (Demucs) with the Python named in tools\python-path.txt ----------
    static string PythonPath()
    {
        string cfg = Path.Combine(Root, @"tools\python-path.txt"), script = Path.Combine(Root, @"tools\separate.py");
        if (!File.Exists(cfg) || !File.Exists(script)) return null;
        string py = File.ReadAllText(cfg).Trim();
        return File.Exists(py) ? py : null;
    }

    static void Separate(Stream s, byte[] wav)
    {
        string py = PythonPath();
        if (py == null) { Reply(s, "404 Not Found", "text/plain; charset=utf-8", Encoding.UTF8.GetBytes("not installed"), "POST"); return; }
        lock (SepLock)
        {
            CleanOld();
            string id = Guid.NewGuid().ToString("N"), dir = Path.Combine(SepRoot, id), input = Path.Combine(dir, "in.wav");
            Directory.CreateDirectory(dir);
            File.WriteAllBytes(input, wav);
            ProcessStartInfo psi = new ProcessStartInfo(py, "\"" + Path.Combine(Root, @"tools\separate.py") + "\" \"" + input + "\" \"" + dir + "\"");
            psi.UseShellExecute = false;
            psi.CreateNoWindow = true;
            psi.RedirectStandardOutput = true;
            psi.RedirectStandardError = true;
            using (Process p = Process.Start(psi))
            {
                Task<string> err = p.StandardError.ReadToEndAsync(); // drain both pipes so neither can block the child
                string output = p.StandardOutput.ReadToEnd().Trim();
                p.WaitForExit();
                File.Delete(input);
                if (p.ExitCode != 0)
                {
                    string e = err.Result;
                    Reply(s, "500 Internal Server Error", "text/plain; charset=utf-8", Encoding.UTF8.GetBytes(e.Length > 800 ? e.Substring(e.Length - 800) : e), "POST");
                    return;
                }
                string device = output.Contains("cuda") ? "cuda" : "cpu";
                Reply(s, "200 OK", "application/json", Encoding.UTF8.GetBytes("{\"id\":\"" + id + "\",\"device\":\"" + device + "\"}"), "POST");
            }
        }
    }

    static void CleanOld() // stems are fetched right after separation; anything older than an hour is leftover
    {
        if (!Directory.Exists(SepRoot)) return;
        foreach (string d in Directory.GetDirectories(SepRoot))
        {
            try { if (DateTime.Now - Directory.GetCreationTime(d) > TimeSpan.FromHours(1)) Directory.Delete(d, true); }
            catch (IOException) { }
            catch (UnauthorizedAccessException) { }
        }
    }

    static string TypeOf(string file)
    {
        switch (Path.GetExtension(file).ToLowerInvariant())
        {
            case ".html": return "text/html; charset=utf-8";
            case ".js": return "text/javascript; charset=utf-8";
            case ".css": return "text/css; charset=utf-8";
            case ".png": return "image/png";
            case ".ico": return "image/x-icon";
            case ".json": return "application/json";
            case ".wav": return "audio/wav";
            case ".md": case ".txt": return "text/plain; charset=utf-8";
            default: return "application/octet-stream";
        }
    }
}
