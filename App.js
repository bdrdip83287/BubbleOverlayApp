import React, { useState, useRef, useEffect, useCallback } from "react";
import {
    View,
    TextInput,
    StyleSheet,
    StatusBar,
    Animated,
    PanResponder,
    Dimensions,
    TouchableWithoutFeedback,
    Text,
    ScrollView,
    FlatList,
    Keyboard,
    Alert,
    Modal,
    Clipboard,
    TouchableOpacity,
    Platform,
    Share,
    AppState
} from "react-native";
import Slider from '@react-native-community/slider';
import Icon from 'react-native-vector-icons/Ionicons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import RNFS from 'react-native-fs';
import SQLite from 'react-native-sqlite-storage';
import {
    checkNotifications,
    requestNotifications,
    RESULTS
} from 'react-native-permissions';

// Crypto polyfill
import 'react-native-get-random-values';
import { sha256 } from 'react-native-sha256';

const { width, height } = Dimensions.get("window");
const BUBBLE_SIZE = 50;
const EDGE_SNAP = 10;
const NOTE_MIN_WIDTH = 180;
const NOTE_MIN_HEIGHT = 180;
const DEFAULT_NOTE_WIDTH = 220;
const DEFAULT_NOTE_HEIGHT = 380;
const DEFAULT_TEXT_COLOR = '#333';
const DEFAULT_TEXT_SIZE = 18;
const DEFAULT_CHILD_BG_COLOR = '#fff8dc';
const DEFAULT_MAIN_BG_COLOR = '#fff8dc';

const DARK_MODE_COLORS = {
    mainBgColor: '#1a1a1a',
    childBgColor: '#2d2d2d',
    topBarColor: '#3a3a3a',
    bottomBarColor: '#3a3a3a',
    textColor: '#e0e0e0',
    iconColor: '#e0e0e0',
    closeIconColor: '#ff6b6b'
};

const TRANSITION_DURATION = {
    MINIMIZE: 400,
    SETTINGS: 300,
    MODAL: 350,
    BUBBLE: 250
};

const LIGHT_MODE_COLORS = {
    mainBgColor: DEFAULT_MAIN_BG_COLOR,
    childBgColor: DEFAULT_CHILD_BG_COLOR,
    topBarColor: '#f9e79f',
    bottomBarColor: '#f9e79f',
    textColor: DEFAULT_TEXT_COLOR,
    iconColor: '#444',
    closeIconColor: '#C0392B'
};

const STORAGE_KEYS = {
    NOTES: '@floating_notes_notes',
    SETTINGS: '@floating_notes_settings',
    MASTER_PASSWORD: '@floating_notes_master_password',
    NOTIFICATION_ENABLED: '@floating_notes_notification_enabled',
    SECURITY_QUESTION: '@floating_notes_security_question',
    ENCRYPTION_KEY: '@floating_notes_encryption_key',
    DARK_MODE_ENABLED: '@floating_notes_dark_mode_enabled',
    IS_PASSWORD_SET: '@floating_notes_is_password_set',
    BACKUP_INFO_SHOWN: '@floating_notes_backup_info_shown',
    LAST_BACKUP_TIME: '@floating_notes_last_backup_time',
    DATA_SOURCE: '@floating_notes_data_source',
    SCROLL_SPEED: '@floating_notes_scroll_speed'
};

const SECURITY_QUESTIONS_LIST = [
    "What is your mother's maiden name?",
    "What was your first pet's name?",
    "What city were you born in?",
    "What was your childhood nickname?",
    "What is your favorite book?",
    "What is the name of your first school?"
];

const generateEncryptionKey = async () => {
    const timestamp = Date.now().toString();
    const random = Math.random().toString();
    const hash = await sha256(timestamp + random);
    return hash;
};

const encryptData = async (data, key) => {
    try {
        const dataString = JSON.stringify(data);
        const encrypted = await sha256(dataString + key);
        return encrypted;
    } catch (error) {
        return null;
    }
};

const createNewNote = (lastX, lastY) => ({
    id: Date.now().toString() + Math.random(),
    title: 'Untitled Note',
    content: '',
    preview: '',
    width: DEFAULT_NOTE_WIDTH,
    height: DEFAULT_NOTE_HEIGHT,
    isLocked: false,
    lastEdited: Date.now(),
    lastX: lastX || width - 100,
    lastY: lastY || 400,
    lastW: DEFAULT_NOTE_WIDTH,
    lastH: DEFAULT_NOTE_HEIGHT,
    lastCursorPos: 0,
    lastScrollY: 0,
});

// Backup directory
const BACKUP_DIRECTORY = RNFS.DocumentDirectoryPath + '/floating_notes_backup/';
const BACKUP_JSON_FILE = BACKUP_DIRECTORY + 'notes_backup.json';
const BACKUP_SETTINGS_FILE = BACKUP_DIRECTORY + 'settings_backup.json';

// SQLite setup
SQLite.enablePromise(true);

const getDBConnection = async () => {
    return SQLite.openDatabase(
        {
            name: 'notes_backup.db',
            location: 'default',
        },
        () => {},
        (error) => {
            console.error('Database error:', error);
        }
    );
};

const initDatabase = async () => {
    try {
        const db = await getDBConnection();
        await db.executeSql(`
            CREATE TABLE IF NOT EXISTS notes_backup (
                id TEXT PRIMARY KEY,
                title TEXT,
                content TEXT,
                preview TEXT,
                width REAL,
                height REAL,
                isLocked INTEGER,
                lastEdited INTEGER,
                lastX REAL,
                lastY REAL,
                lastW REAL,
                lastH REAL,
                lastCursorPos INTEGER,
                lastScrollY INTEGER,
                created_at INTEGER
            );
        `);
        await db.executeSql(`
            CREATE TABLE IF NOT EXISTS backup_info (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                backup_time INTEGER,
                note_count INTEGER,
                source TEXT
            );
        `);
        return db;
    } catch (error) {
        console.error('Database init error:', error);
        return null;
    }
};

const saveNotesToDatabase = async (notes) => {
    try {
        const database = await initDatabase();
        if (!database) return false;
        await database.executeSql('BEGIN TRANSACTION;');
        try {
            await database.executeSql('DELETE FROM notes_backup;');
            for (const note of notes) {
                await database.executeSql(
                    `INSERT OR REPLACE INTO notes_backup 
                    (id, title, content, preview, width, height, isLocked, 
                     lastEdited, lastX, lastY, lastW, lastH, lastCursorPos, lastScrollY, created_at) 
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
                    [
                        note.id,
                        note.title || 'Untitled Note',
                        note.content || '',
                        note.preview || '',
                        note.width || DEFAULT_NOTE_WIDTH,
                        note.height || DEFAULT_NOTE_HEIGHT,
                        note.isLocked ? 1 : 0,
                        note.lastEdited || Date.now(),
                        note.lastX || width - 100,
                        note.lastY || 400,
                        note.lastW || DEFAULT_NOTE_WIDTH,
                        note.lastH || DEFAULT_NOTE_HEIGHT,
                        note.lastCursorPos || 0,
                        note.lastScrollY || 0,
                        Date.now()
                    ]
                );
            }
            await database.executeSql(
                'INSERT INTO backup_info (backup_time, note_count, source) VALUES (?, ?, ?);',
                [Date.now(), notes.length, 'auto_backup']
            );
            await database.executeSql('COMMIT;');
            return true;
        } catch (error) {
            await database.executeSql('ROLLBACK;');
            throw error;
        }
    } catch (error) {
        console.error('Database save error:', error);
        return false;
    }
};

const loadNotesFromDatabase = async () => {
    try {
        const database = await initDatabase();
        if (!database) return null;
        const [results] = await database.executeSql(
            'SELECT * FROM notes_backup ORDER BY created_at DESC;'
        );
        if (results.rows.length > 0) {
            const loadedNotes = [];
            for (let i = 0; i < results.rows.length; i++) {
                const row = results.rows.item(i);
                loadedNotes.push({
                    id: row.id || Date.now().toString() + Math.random(),
                    title: row.title || 'Untitled Note',
                    content: row.content || '',
                    preview: row.preview || '',
                    width: row.width || DEFAULT_NOTE_WIDTH,
                    height: row.height || DEFAULT_NOTE_HEIGHT,
                    isLocked: row.isLocked === 1,
                    lastEdited: row.lastEdited || Date.now(),
                    lastX: row.lastX || width - 100,
                    lastY: row.lastY || 400,
                    lastW: row.lastW || DEFAULT_NOTE_WIDTH,
                    lastH: row.lastH || DEFAULT_NOTE_HEIGHT,
                    lastCursorPos: row.lastCursorPos || 0,
                    lastScrollY: row.lastScrollY || 0
                });
            }
            await AsyncStorage.setItem(STORAGE_KEYS.DATA_SOURCE, 'sqlite_db');
            return loadedNotes;
        }
        return null;
    } catch (error) {
        console.error('Database load error:', error);
        return null;
    }
};

const createBackupDirectory = async () => {
    try {
        const backupDirExists = await RNFS.exists(BACKUP_DIRECTORY);
        if (!backupDirExists) {
            await RNFS.mkdir(BACKUP_DIRECTORY);
        }
    } catch (error) {
        console.error('Backup directory creation error:', error);
    }
};

const saveNotesToJSONFile = async (notes) => {
    try {
        await createBackupDirectory();
        const backupData = {
            notes: notes,
            timestamp: Date.now(),
            version: '2.0',
            appVersion: '1.0.0'
        };
        const backupJson = JSON.stringify(backupData);
        await RNFS.writeFile(BACKUP_JSON_FILE, backupJson, 'utf8');
        await AsyncStorage.setItem(STORAGE_KEYS.LAST_BACKUP_TIME, Date.now().toString());
        return true;
    } catch (error) {
        console.error('JSON save error:', error);
        return false;
    }
};

const loadNotesFromJSONFile = async () => {
    try {
        const fileExists = await RNFS.exists(BACKUP_JSON_FILE);
        if (fileExists) {
            const fileStat = await RNFS.stat(BACKUP_JSON_FILE);
            if (fileStat.size > 0) {
                const jsonString = await RNFS.readFile(BACKUP_JSON_FILE, 'utf8');
                const backupData = JSON.parse(jsonString);
                if (backupData.notes && Array.isArray(backupData.notes) && backupData.notes.length > 0) {
                    await AsyncStorage.setItem(STORAGE_KEYS.DATA_SOURCE, 'json_file');
                    await AsyncStorage.setItem(STORAGE_KEYS.LAST_BACKUP_TIME, backupData.timestamp?.toString() || Date.now().toString());
                    return backupData.notes.map(note => ({
                        id: note.id || Date.now().toString() + Math.random(),
                        title: note.title || 'Untitled Note',
                        content: note.content || '',
                        preview: note.preview || '',
                        width: note.width || DEFAULT_NOTE_WIDTH,
                        height: note.height || DEFAULT_NOTE_HEIGHT,
                        isLocked: note.isLocked || false,
                        lastEdited: note.lastEdited || Date.now(),
                        lastX: note.lastX || width - 100,
                        lastY: note.lastY || 400,
                        lastW: note.lastW || DEFAULT_NOTE_WIDTH,
                        lastH: note.lastH || DEFAULT_NOTE_HEIGHT,
                        lastCursorPos: note.lastCursorPos || 0,
                        lastScrollY: note.lastScrollY || 0
                    }));
                }
            }
        }
    } catch (error) {
        console.error('JSON load error:', error);
    }
    return null;
};

const saveNotesToBackup = async (notes) => {
    try {
        if (!notes || notes.length === 0) return false;
        await AsyncStorage.setItem(STORAGE_KEYS.NOTES, JSON.stringify(notes));
        const backupPromises = [
            saveNotesToJSONFile(notes).catch(err => false),
            saveNotesToDatabase(notes).catch(err => false)
        ];
        const results = await Promise.allSettled(backupPromises);
        return results[0].status === 'fulfilled' && results[0].value === true || 
               results[1].status === 'fulfilled' && results[1].value === true;
    } catch (error) {
        console.error('Backup error:', error);
        return false;
    }
};

const loadNotesFromAllSources = async () => {
    let loadedNotes = null;
    try {
        loadedNotes = await loadNotesFromJSONFile();
        if (!loadedNotes || loadedNotes.length === 0) {
            loadedNotes = await loadNotesFromDatabase();
        }
        if (!loadedNotes || loadedNotes.length === 0) {
            const savedNotes = await AsyncStorage.getItem(STORAGE_KEYS.NOTES);
            if (savedNotes) {
                const parsedNotes = JSON.parse(savedNotes);
                if (Array.isArray(parsedNotes) && parsedNotes.length > 0) {
                    loadedNotes = parsedNotes;
                    setTimeout(() => saveNotesToBackup(parsedNotes), 1000);
                }
            }
        }
        if (!loadedNotes || loadedNotes.length === 0) {
            loadedNotes = [createNewNote(width - 100, 400)];
        }
        return loadedNotes;
    } catch (error) {
        console.error('All sources load error:', error);
        return [createNewNote(width - 100, 400)];
    }
};

const saveSettingsToBackup = async (settings) => {
    try {
        await createBackupDirectory();
        const backupData = { settings, timestamp: Date.now(), version: '2.0' };
        await RNFS.writeFile(BACKUP_SETTINGS_FILE, JSON.stringify(backupData), 'utf8');
        return true;
    } catch (error) {
        console.error('Settings backup error:', error);
        return false;
    }
};

const loadSettingsFromBackup = async () => {
    try {
        const fileExists = await RNFS.exists(BACKUP_SETTINGS_FILE);
        if (fileExists) {
            const fileStat = await RNFS.stat(BACKUP_SETTINGS_FILE);
            if (fileStat.size > 0) {
                const jsonString = await RNFS.readFile(BACKUP_SETTINGS_FILE, 'utf8');
                const backupData = JSON.parse(jsonString);
                if (backupData.settings) return backupData.settings;
            }
        }
    } catch (error) {
        console.error('Settings load error:', error);
    }
    return null;
};

export default function App() {

    // --- State Variables ---
    const [notes, setNotes] = useState([]);
    const [activeNoteId, setActiveNoteId] = useState(null);
    const [showNote, setShowNote] = useState(false);
    const [enableNotification, setEnableNotification] = useState(false);
    const [darkModeEnabled, setDarkModeEnabled] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [history, setHistory] = useState({ past: [], current: '', future: [] });
    const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);
    const [isSecurityQuestionModalVisibleForUpdate, setIsSecurityQuestionModalVisibleForUpdate] = useState(false);
    const [isNoteTemporarilyUnlockedId, setIsNoteTemporarilyUnlockedId] = useState(null);
    const [masterPassword, setMasterPassword] = useState("");
    const [isPasswordSet, setIsPasswordSet] = useState(false);
    const [isSettingsVisible, setIsSettingsVisible] = useState(false);
    const [isChangePasswordModalVisible, setIsChangePasswordModalVisible] = useState(false);
    const [newMasterPasswordInput, setNewMasterPasswordInput] = useState('');
    const [oldMasterPasswordInput, setOldMasterPasswordInput] = useState('');
    const [showNewMasterPassword, setShowNewMasterPassword] = useState(false);
    const [showOldMasterPassword, setShowOldMasterPassword] = useState(false);
    const [isMinimizing, setIsMinimizing] = useState(false);
    const [isSettingsOpening, setIsSettingsOpening] = useState(false);
    const [isSettingsClosing, setIsSettingsClosing] = useState(false);
    const [isModalAnimating, setIsModalAnimating] = useState(false);
    const [isSecurityQuestionSetupModalVisible, setIsSecurityQuestionSetupModalVisible] = useState(false);
    const [isSecurityQuestionModalVisible, setIsSecurityQuestionModalVisible] = useState(false);
    const [securityQuestion, setSecurityQuestion] = useState({
        question: SECURITY_QUESTIONS_LIST[0],
        answer: '',
        encryptedAnswer: ''
    });
    const [securityAnswerInput, setSecurityAnswerInput] = useState('');
    const [showSecurityAnswer, setShowSecurityAnswer] = useState(false);
    const [isSecuritySetupComplete, setIsSecuritySetupComplete] = useState(false);
    const [encryptionKey, setEncryptionKey] = useState('');
    const [isRecoveryPasswordModalVisible, setIsRecoveryPasswordModalVisible] = useState(false);
    const [recoveryPasswordInput, setRecoveryPasswordInput] = useState('');
    const [showRecoveryPassword, setShowRecoveryPassword] = useState(false);
    const [isFullScreen, setIsFullScreen] = useState(false);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const deleteConfirmAnim = useRef(new Animated.Value(0)).current;
    const [isViewingMode, setIsViewingMode] = useState(true);
    const [selection, setSelection] = useState({ start: 0, end: 0 });
    const lastCursorPosRef = useRef(0);
    const currentScrollYRef = useRef(0);
    const isFocusingRef = useRef(false);
    const scrollSyncTimeoutRef = useRef(null);
    const scrollViewRef = useRef(null);
    const editScrollViewRef = useRef(null);
    const textInputRef = useRef(null);
    const [showFastScroll, setShowFastScroll] = useState(false);
    const fastScrollAnim = useRef(new Animated.Value(0)).current;
    const scrollIndicatorOpacity = useRef(new Animated.Value(0)).current;
    const isFastScrolling = useRef(false);
    const fastScrollTimeoutRef = useRef(null);
    const scrollViewContentHeightRef = useRef(0);
    const scrollViewVisibleHeightRef = useRef(0);
    const fastScrollIndicatorY = useRef(new Animated.Value(0)).current;
    const textSelectionIntervalRef = useRef(null);
    const selectionStartPosRef = useRef(0);
    const isSelectingText = useRef(false);
    const selectionDirectionRef = useRef(null);
    const isInTextSelectionMode = useRef(false);
    const lastSelectionYRef = useRef(0);
    const [scrollSpeed, setScrollSpeed] = useState(1.0);
    const scrollMomentumTimeoutRef = useRef(null);
    
    // ✅ settings state - এটা যোগ করতে হবে
    const [settings, setSettings] = useState({
        childTextColor: DEFAULT_TEXT_COLOR,
        childTextSize: DEFAULT_TEXT_SIZE,
        childBgColor: DEFAULT_CHILD_BG_COLOR,
        mainBgColor: DEFAULT_MAIN_BG_COLOR,
        opacity: 0.9,
        isLocked: false,
        topBarColor: '#f9e79f',
        bottomBarColor: '#f9e79f',
        iconColor: '#444',
        closeIconColor: '#C0392B',
    });

    // মডাল স্টেট
    const [passwordModalVisible, setPasswordModalVisible] = useState(false);
    const [tempPassword, setTempPassword] = useState('');
    const [showUnlockPassword, setShowUnlockPassword] = useState(false);
    const [deleteModalVisible, setDeleteModalVisible] = useState(false);
    const [noteToDeleteId, setNoteToDeleteId] = useState(null);
    const [deletePassword, setDeletePassword] = useState('');

    // --- Animation & Ref Variables ---
    const isDragging = useRef(false);
    const saveTimerRef = useRef(null);
    const noteWidth = useRef(new Animated.Value(DEFAULT_NOTE_WIDTH)).current;
    const noteHeight = useRef(new Animated.Value(DEFAULT_NOTE_HEIGHT)).current;
    const notePan = useRef(new Animated.ValueXY({ x: width - 100, y: 400 })).current;
    const bubblePan = useRef(new Animated.ValueXY({ x: width - BUBBLE_SIZE - EDGE_SNAP, y: 100 })).current;
    const scaleAnim = useRef(new Animated.Value(1)).current;
    const opacityAnim = useRef(new Animated.Value(1)).current;
    const startSizeRef = useRef({ width: DEFAULT_NOTE_WIDTH, height: DEFAULT_NOTE_HEIGHT });
    const isAnimatingClose = useRef(false);
    const bubblePositionRef = useRef({ x: width - BUBBLE_SIZE - EDGE_SNAP, y: 100 });
    const notePositionBeforeMinimizeRef = useRef({ x: width - 100, y: 400, width: DEFAULT_NOTE_WIDTH, height: DEFAULT_NOTE_HEIGHT });
    const [isAppLoaded, setIsAppLoaded] = useState(false);
    
    const clamp = (v, a, b) => Math.min(Math.max(v, a), b);
    const activeNote = notes.find(n => n.id === activeNoteId);
    
    // ... বাকি কোড (আপনার আগের App.js থেকে বাকি অংশ এখানে বসবে)
    
    return (
        <View style={styles.container}>
            <StatusBar hidden />
            {!showNote ? renderBubble() : (
                <Animated.View style={[styles.note, { width: noteWidth, height: noteHeight, transform: [{ translateX: notePan.x }, { translateY: notePan.y }, { scale: scaleAnim }], opacity: settings.opacity, overflow: 'hidden' }]}>
                    {renderNoteContent()}
                </Animated.View>
            )}
            {renderDeleteConfirmation()}
            {renderSettingsModal()}
            {renderSetPasswordModal()}
            {renderChangePasswordModal()}
            {renderPasswordModal()}
            {renderSecurityQuestionSetupModal()}
            {renderSecurityQuestionModal()}
            {renderRecoveryPasswordModal()}
        </View>
    );
}

// --- Styles ---
const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: "#fff" },
    bubble: {
        position: "absolute",
        width: 50,
        height: 50,
        borderRadius: 25,
        backgroundColor: "#ffe066",
        justifyContent: "center",
        alignItems: "center",
        elevation: 6,
    },
    // ... বাকি স্টাইল (আপনার আগের App.js থেকে বাকি স্টাইল এখানে বসবে)
});
