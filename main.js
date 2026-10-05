const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

let mainWindow;

// Geheimschlüssel für die Lizenzprüfung
const LICENSE_SECRET = 'WICHTELWEG_KOTTENHEIM_SECRET_KEY_2026';

// Pfade zu den JSON-Dateien im sicheren AppData-Verzeichnis des Benutzers
const dataFilePath = path.join(app.getPath('userData'), 'wichtelweg_data.json');
const licenseDataPath = path.join(app.getPath('userData'), 'license-config.json');



// --- DATENBANK-FUNKTIONEN (Stationen & Teilnehmer) ---

function readDatabase() {
    try {
        if (fs.existsSync(dataFilePath)) {
            const fileData = fs.readFileSync(dataFilePath, 'utf8');
            return JSON.parse(fileData);
        }
    } catch (err) {
        console.error('Fehler beim Lesen der JSON-Daten:', err);
    }
    return { stationen: [], teilnehmer: [] };
}

function writeDatabase(data) {
    try {
        fs.writeFileSync(dataFilePath, JSON.stringify(data, null, 2), 'utf8');
    } catch (err) {
        console.error('Fehler beim Speichern der JSON-Daten:', err);
    }
}

// --- LIZENZ-FUNKTIONEN ---

function validateLicenseKey(key) {
    try {
        if (!key || typeof key !== 'string') return false;
        const parts = key.trim().toUpperCase().split('-');
        if (parts.length !== 4) return false;

        const dataPart = `${parts[0]}-${parts[1]}-${parts[2]}`;
        const providedChecksum = parts[3];

        const expectedChecksum = crypto
            .createHmac('sha256', LICENSE_SECRET)
            .update(dataPart)
            .digest('hex')
            .substring(0, 4)
            .toUpperCase();

        return providedChecksum === expectedChecksum;
    } catch (err) {
        return false;
    }
}

function loadSavedLicense() {
    try {
        if (fs.existsSync(licenseDataPath)) {
            const data = JSON.parse(fs.readFileSync(licenseDataPath, 'utf8'));
            return data.licenseKey || null;
        }
    } catch (err) {
        console.error('Fehler beim Laden der Lizenz:', err);
    }
    return null;
}

function saveLicenseKey(key) {
    try {
        const data = { licenseKey: key.trim().toUpperCase() };
        fs.writeFileSync(licenseDataPath, JSON.stringify(data, null, 2), 'utf8');
        return true;
    } catch (err) {
        console.error('Fehler beim Speichern der Lizenz:', err);
        return false;
    }
}

// --- FENSTER-ERSTELLUNG ---

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1000,
        height: 700,
        frame: false,             // Entfernt die Windows-Standardleiste
        titleBarStyle: 'hidden',  // Versteckt die System-Titelleiste
        autoHideMenuBar: true,    // Versteckt die Standard-Menüleiste
        icon: path.join(__dirname, 'icon.ico'), // Festgelegtes Anwendungs-Icon
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false
        }
    });

    const savedKey = loadSavedLicense();
    if (savedKey && validateLicenseKey(savedKey)) {
        mainWindow.loadFile('index.html');
    } else {
        mainWindow.loadFile('license.html');
    }
}

app.whenReady().then(() => {
    createWindow();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});

// --- FENSTER-STEUERUNG (Minimieren / Maximieren / Schließen) ---

ipcMain.on('window-control', (event, action) => {
    if (!mainWindow) return;

    if (action === 'minimize') {
        mainWindow.minimize();
    } else if (action === 'maximize') {
        if (mainWindow.isMaximized()) {
            mainWindow.unmaximize();
        } else {
            mainWindow.maximize();
        }
    } else if (action === 'close') {
        mainWindow.close();
    }
});

// --- IPC HANDLER FÜR LIZENZ ---

ipcMain.handle('verify-license', (event, key) => {
    if (validateLicenseKey(key)) {
        return { success: true };
    }
    return { success: false, message: 'Der eingegebene Lizenzschlüssel ist ungültig.' };
});

ipcMain.handle('verify-and-save-license', (event, key) => {
    if (validateLicenseKey(key)) {
        const saved = saveLicenseKey(key);
        if (saved) {
            return { success: true };
        }
    }
    return { success: false, message: 'Der Lizenzschlüssel ist ungültig oder konnte nicht gespeichert werden.' };
});

ipcMain.handle('check-saved-license', () => {
    const savedKey = loadSavedLicense();
    if (savedKey && validateLicenseKey(savedKey)) {
        return { valid: true };
    }
    return { valid: false };
});

// --- IPC HANDLER FÜR STATIONEN ---

ipcMain.handle('get-stationen', () => {
    const db = readDatabase();
    return db.stationen;
});

ipcMain.handle('add-station', (event, data) => {
    const db = readDatabase();
    const newId = db.stationen.length > 0 ? Math.max(...db.stationen.map(s => s.id)) + 1 : 1;
    const newStation = { id: newId, ...data };
    db.stationen.push(newStation);
    writeDatabase(db);
    return newId;
});

ipcMain.handle('update-station', (event, data) => {
    const db = readDatabase();
    db.stationen = db.stationen.map(s => s.id === data.id ? { ...s, ...data } : s);
    writeDatabase(db);
    return true;
});

ipcMain.handle('delete-station', (event, id) => {
    const db = readDatabase();
    db.stationen = db.stationen.filter(s => s.id !== id);
    writeDatabase(db);
    return true;
});

// --- IPC HANDLER FÜR TEILNEHMER ---

ipcMain.handle('get-teilnehmer', () => {
    const db = readDatabase();
    return db.teilnehmer;
});

ipcMain.handle('add-teilnehmer', (event, data) => {
    const db = readDatabase();
    const newId = db.teilnehmer.length > 0 ? Math.max(...db.teilnehmer.map(t => t.id)) + 1 : 1;
    const newTeilnehmer = { id: newId, ...data };
    db.teilnehmer.push(newTeilnehmer);
    writeDatabase(db);
    return newId;
});

ipcMain.handle('update-teilnehmer', (event, data) => {
    const db = readDatabase();
    db.teilnehmer = db.teilnehmer.map(t => t.id === data.id ? { ...t, ...data } : t);
    writeDatabase(db);
    return true;
});

ipcMain.handle('delete-teilnehmer', (event, id) => {
    const db = readDatabase();
    db.teilnehmer = db.teilnehmer.filter(t => t.id !== id);
    writeDatabase(db);
    return true;
});