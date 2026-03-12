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
import ReactNativeBlobUtil from 'react-native-blob-util';
import SQLite from 'react-native-sqlite-storage';
import {
    checkNotifications,
    requestNotifications,
    RESULTS
} from 'react-native-permissions';

// Crypto polyfill for React Native CLI
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

// ট্রানজিশন ডুরেশন কনস্ট্যান্ট
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
    SCROLL_SPEED: '@floating_notes_scroll_speed' // স্ক্রলিং গতি সংরক্ষণ
};

const SECURITY_QUESTIONS_LIST = [
    "What is your mother's maiden name?",
    "What was your first pet's name?",
    "What city were you born in?",
    "What was your childhood nickname?",
    "What is your favorite book?",
    "What is the name of your first school?"
];

// এনক্রিপশন ইউটিলিটি ফাংশনস
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

// ব্যাকআপ ডিরেক্টরি পাথ
const BACKUP_DIRECTORY = RNFS.DocumentDirectoryPath + '/floating_notes_backup/';
const BACKUP_JSON_FILE = BACKUP_DIRECTORY + 'notes_backup.json';
const BACKUP_SETTINGS_FILE = BACKUP_DIRECTORY + 'settings_backup.json';

// ✅ SQLite ডাটাবেস ইনিশিয়ালাইজেশন
SQLite.enablePromise(true);

const getDBConnection = async () => {
    return SQLite.openDatabase(
        {
            name: 'notes_backup.db',
            location: 'default',
        },
        () => { },
        (error) => {
            console.error('Database error:', error);
        }
    );
};

const initDatabase = async () => {
    try {
        const db = await getDBConnection();

        // টেবিল তৈরি
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

// ✅ SQLite ডাটাবেসে নোটস সেভ করুন
const saveNotesToDatabase = async (notes) => {
    try {
        const database = await initDatabase();
        if (!database) return false;

        await database.executeSql('BEGIN TRANSACTION;');

        try {
            // আগের ডেটা ডিলিট করুন
            await database.executeSql('DELETE FROM notes_backup;');

            // নতুন ডেটা ইনসার্ট করুন
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

            // ব্যাকআপ ইনফো সেভ করুন
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

// ✅ SQLite ডাটাবেস থেকে নোটস লোড করুন
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

            // ডেটা সোর্স ট্র্যাক করুন
            await AsyncStorage.setItem(STORAGE_KEYS.DATA_SOURCE, 'sqlite_db');

            return loadedNotes;
        }

        return null;
    } catch (error) {
        console.error('Database load error:', error);
        return null;
    }
};

// ✅ উন্নত ব্যাকআপ সিস্টেম ফাংশনস
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

// ✅ ব্যাকআপ নোটিফিকেশন শো করার ফাংশন
const showBackupNotification = async () => {
    try {
        const backupInfoShown = await AsyncStorage.getItem(STORAGE_KEYS.BACKUP_INFO_SHOWN);

        if (!backupInfoShown || backupInfoShown !== 'true') {
            Alert.alert(
                "📁 Auto Backup Enabled",
                "Your notes are automatically backed up to your device storage. Even if you uninstall the app, your notes will be preserved and restored when you reinstall.",
                [
                    {
                        text: "Got it",
                        onPress: async () => {
                            await AsyncStorage.setItem(STORAGE_KEYS.BACKUP_INFO_SHOWN, 'true');
                        }
                    }
                ]
            );
        }
    } catch (error) {
        console.error('Backup notification error:', error);
    }
};

// ✅ JSON ফাইলে নোটস সেভ করুন
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

// ✅ JSON ফাইল থেকে নোটস লোড করুন
const loadNotesFromJSONFile = async () => {
    try {
        const fileExists = await RNFS.exists(BACKUP_JSON_FILE);

        if (fileExists) {
            const fileStat = await RNFS.stat(BACKUP_JSON_FILE);
            if (fileStat.size > 0) {
                const jsonString = await RNFS.readFile(BACKUP_JSON_FILE, 'utf8');
                const backupData = JSON.parse(jsonString);

                if (backupData.notes && Array.isArray(backupData.notes) && backupData.notes.length > 0) {

                    // ডেটা সোর্স ট্র্যাক করুন
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

// ✅ উন্নত কম্বাইন্ড ব্যাকআপ - দুই জায়গায় সেভ
const saveNotesToBackup = async (notes) => {
    try {
        if (!notes || notes.length === 0) {
            return false;
        }

        // AsyncStorage তে সেভ (প্রাথমিক স্টোরেজ)
        await AsyncStorage.setItem(STORAGE_KEYS.NOTES, JSON.stringify(notes));

        // দুই জায়গায় ব্যাকআপ (সমান্তরালভাবে)
        const backupPromises = [
            saveNotesToJSONFile(notes).catch(err => {
                console.error('JSON backup error:', err);
                return false;
            }),
            saveNotesToDatabase(notes).catch(err => {
                console.error('DB backup error:', err);
                return false;
            })
        ];

        const results = await Promise.allSettled(backupPromises);

        const jsonSuccess = results[0].status === 'fulfilled' && results[0].value === true;
        const dbSuccess = results[1].status === 'fulfilled' && results[1].value === true;

        return jsonSuccess || dbSuccess;
    } catch (error) {
        console.error('Backup error:', error);
        return false;
    }
};

// ✅ উন্নত কম্বাইন্ড রিস্টোর - তিন স্তরের ব্যাকআপ থেকে ডেটা লোড
const loadNotesFromAllSources = async () => {
    let loadedNotes = null;
    let dataSource = 'default';

    try {
        // স্ট্র্যাটেজি ১: প্রথমে JSON ফাইল থেকে লোড করুন (সবচেয়ে নির্ভরযোগ্য)
        loadedNotes = await loadNotesFromJSONFile();
        if (loadedNotes && loadedNotes.length > 0) {
            dataSource = 'json_file';
        }

        // স্ট্র্যাটেজি ২: JSON না থাকলে SQLite ডাটাবেস থেকে
        if (!loadedNotes || loadedNotes.length === 0) {
            loadedNotes = await loadNotesFromDatabase();
            if (loadedNotes && loadedNotes.length > 0) {
                dataSource = 'sqlite_db';
            }
        }

        // স্ট্র্যাটেজি ৩: উভয় ব্যাকআপ না থাকলে AsyncStorage থেকে
        if (!loadedNotes || loadedNotes.length === 0) {
            try {
                const savedNotes = await AsyncStorage.getItem(STORAGE_KEYS.NOTES);
                if (savedNotes) {
                    const parsedNotes = JSON.parse(savedNotes);
                    if (Array.isArray(parsedNotes) && parsedNotes.length > 0) {
                        loadedNotes = parsedNotes;
                        dataSource = 'async_storage';

                        // AsyncStorage থেকে পাওয়া ডেটা ব্যাকআপেও সেভ করুন
                        setTimeout(() => {
                            saveNotesToBackup(parsedNotes).then(success => {
                                console.log('Backup from AsyncStorage:', success);
                            });
                        }, 1000);
                    }
                }
            } catch (error) {
                console.error('AsyncStorage load error:', error);
            }
        }

        // ডেটা সোর্স ট্র্যাক করুন
        if (loadedNotes && loadedNotes.length > 0) {
            await AsyncStorage.setItem(STORAGE_KEYS.DATA_SOURCE, dataSource);
        } else {
            loadedNotes = [createNewNote(width - 100, 400)];
            dataSource = 'default';
            await AsyncStorage.setItem(STORAGE_KEYS.DATA_SOURCE, 'default');
        }

        return loadedNotes;

    } catch (error) {
        console.error('All sources load error:', error);
        // সর্বশেষ ফ্যালব্যাক - নতুন নোট তৈরি
        return [createNewNote(width - 100, 400)];
    }
};

// ✅ সেটিংস ব্যাকআপ ফাংশন
const saveSettingsToBackup = async (settings) => {
    try {
        await createBackupDirectory();

        const backupData = {
            settings: settings,
            timestamp: Date.now(),
            version: '2.0'
        };

        await RNFS.writeFile(BACKUP_SETTINGS_FILE, JSON.stringify(backupData), 'utf8');

        return true;
    } catch (error) {
        console.error('Settings backup error:', error);
        return false;
    }
};

// ✅ সেটিংস লোড ফাংশন
const loadSettingsFromBackup = async () => {
    try {
        const fileExists = await RNFS.exists(BACKUP_SETTINGS_FILE);

        if (fileExists) {
            const fileStat = await RNFS.stat(BACKUP_SETTINGS_FILE);
            if (fileStat.size > 0) {
                const jsonString = await RNFS.readFile(BACKUP_SETTINGS_FILE, 'utf8');
                const backupData = JSON.parse(jsonString);

                if (backupData.settings) {
                    return backupData.settings;
                }
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
    const [hasOverlayPermission, setHasOverlayPermission] = useState(false);
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
    // অ্যানিমেশন স্টেট
    const [isMinimizing, setIsMinimizing] = useState(false);
    const [isSettingsOpening, setIsSettingsOpening] = useState(false);
    const [isSettingsClosing, setIsSettingsClosing] = useState(false);
    const [isModalAnimating, setIsModalAnimating] = useState(false);

    // *** সিকিউরিটি প্রশ্ন স্টেট ***
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

    // *** Forget Password Recovery State ***
    const [isRecoveryPasswordModalVisible, setIsRecoveryPasswordModalVisible] = useState(false);
    const [recoveryPasswordInput, setRecoveryPasswordInput] = useState('');
    const [showRecoveryPassword, setShowRecoveryPassword] = useState(false);

    // *** নতুন স্টেট: ফুল স্ক্রিন মোড ***
    const [isFullScreen, setIsFullScreen] = useState(false);

    // *** নতুন স্টেট: ডিলিট কনফার্মেশন ***
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const deleteConfirmAnim = useRef(new Animated.Value(0)).current;

    // *** মূল স্টেট: পঠন মোড / সম্পাদনা মোড নিয়ন্ত্রণ ***
    const [isViewingMode, setIsViewingMode] = useState(true);

    // *** সরলীকৃত কার্সার পজিশন কন্ট্রোল স্টেট ***
    const [selection, setSelection] = useState({ start: 0, end: 0 });

    // *** উন্নত রেফারেন্স ***
    const lastCursorPosRef = useRef(0);
    const currentScrollYRef = useRef(0);
    const isFocusingRef = useRef(false);
    const scrollSyncTimeoutRef = useRef(null);

    // *** স্ক্রলিং রেফারেন্স ***
    const scrollViewRef = useRef(null);
    const editScrollViewRef = useRef(null);
    const textInputRef = useRef(null);

    // *** উন্নত Fast Scroll জন্য স্টেট এবং রেফ ***
    const [showFastScroll, setShowFastScroll] = useState(false);
    const fastScrollAnim = useRef(new Animated.Value(0)).current;
    const scrollIndicatorOpacity = useRef(new Animated.Value(0)).current;
    const isFastScrolling = useRef(false);
    const fastScrollTimeoutRef = useRef(null);
    const scrollViewContentHeightRef = useRef(0);
    const scrollViewVisibleHeightRef = useRef(0);
    const fastScrollIndicatorY = useRef(new Animated.Value(0)).current;

    // *** উন্নত Rapid Text Selection জন্য রেফ ***
    const textSelectionIntervalRef = useRef(null);
    const selectionStartPosRef = useRef(0);
    const isSelectingText = useRef(false);
    const selectionDirectionRef = useRef(null);
    const isInTextSelectionMode = useRef(false);
    const lastSelectionYRef = useRef(0);

    // *** নতুন স্টেট: স্ক্রলিং স্পীড কন্ট্রোল ***
    const [scrollSpeed, setScrollSpeed] = useState(1.0); // 0.5x থেকে 3.0x
    const scrollMomentumTimeoutRef = useRef(null);

    // ডিফল্ট সেটিংস - থিম অনুযায়ী পরিবর্তন হবে
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

    // --- বাবল অবস্থান ট্র্যাকিং ---
    const bubblePositionRef = useRef({ x: width - BUBBLE_SIZE - EDGE_SNAP, y: 100 });
    const notePositionBeforeMinimizeRef = useRef({ x: width - 100, y: 400, width: DEFAULT_NOTE_WIDTH, height: DEFAULT_NOTE_HEIGHT });

    // --- অ্যাপ লোড স্টেট ---
    const [isAppLoaded, setIsAppLoaded] = useState(false);

    // --- Utility ---
    const clamp = (v, a, b) => Math.min(Math.max(v, a), b);
    const activeNote = notes.find(n => n.id === activeNoteId);

    // --- উন্নত স্ক্রলিং কনফিগারেশন ফাংশন ---
    const getEnhancedScrollProps = () => ({
        showsVerticalScrollIndicator: true,
        decelerationRate: scrollSpeed > 2.0 ? "fast" : scrollSpeed > 1.0 ? "normal" : "slow",
        scrollEventThrottle: Math.max(16, Math.floor(32 / scrollSpeed)),
        overScrollMode: "always",
        scrollEnabled: true,
        pagingEnabled: false,
        bounces: true,
        alwaysBounceVertical: true,
        disableIntervalMomentum: false,
        disableScrollViewPanResponder: false,
        fadingEdgeLength: 100,
        nestedScrollEnabled: true,
        persistentScrollbar: true,
    });

    // --- স্ক্রলিং মোমেন্টাম কন্ট্রোল ফাংশন ---
    const handleScrollBeginDrag = () => {
        // টাইমার ক্লিয়ার
        if (scrollMomentumTimeoutRef.current) {
            clearTimeout(scrollMomentumTimeoutRef.current);
        }
    };

    const handleScrollEndDrag = (event) => {
        const { velocity } = event.nativeEvent;

        // ভেলোসিটি বেসড মোমেন্টাম টাইমার
        if (velocity && velocity.y !== 0) {
            const momentumDuration = Math.min(Math.abs(velocity.y) * 1500, 8000); // সর্বোচ্চ 8 সেকেন্ড
            scrollMomentumTimeoutRef.current = setTimeout(() => {
                // মোমেন্টাম শেষ
            }, momentumDuration);
        }
    };

    const handleMomentumScrollEnd = () => {
        if (scrollMomentumTimeoutRef.current) {
            clearTimeout(scrollMomentumTimeoutRef.current);
        }
    };

    // --- উন্নত স্টোরেজ ফাংশনস (তিন স্তরের ব্যাকআপ সহ) ---
    const saveNotesToStorage = async (notesToSave) => {
        try {
            if (!notesToSave || notesToSave.length === 0) {
                return;
            }

            setIsSaving(true);

            // AsyncStorage তে সেভ (তাত্ক্ষণিক)
            await AsyncStorage.setItem(STORAGE_KEYS.NOTES, JSON.stringify(notesToSave));

            // ব্যাকগ্রাউন্ডে ব্যাকআপ (দুই জায়গায়)
            setTimeout(async () => {
                try {
                    const backupSuccess = await saveNotesToBackup(notesToSave);
                    console.log('Background backup:', backupSuccess);
                } catch (backupError) {
                    console.error('Background backup error:', backupError);
                }
            }, 500);

        } catch (error) {
            console.error('Save notes error:', error);
        } finally {
            setTimeout(() => setIsSaving(false), 300);
        }
    };

    // --- ডেটা লোড করার প্রধান ফাংশন ---
    const loadAllData = async () => {

        try {
            // 1. এনক্রিপশন কী লোড/জেনারেট করুন
            const key = await loadOrGenerateEncryptionKey();
            setEncryptionKey(key);

            // 2. সব উৎস থেকে নোটস লোড করুন
            const loadedNotes = await loadNotesFromAllSources();
            setNotes(loadedNotes);

            // 3. সেটিংস লোড করুন
            const loadedSettings = await loadSettingsWithFallback();
            setSettings(loadedSettings);

            // 4. মাস্টার পাসওয়ার্ড লোড করুন
            const loadedMasterPassword = await loadMasterPasswordFromStorage();
            setMasterPassword(loadedMasterPassword.password);
            setIsPasswordSet(loadedMasterPassword.isSet);

            // 5. সিকিউরিটি প্রশ্ন লোড করুন
            const loadedSecurityQuestion = await loadSecurityQuestionFromStorage();
            setSecurityQuestion(loadedSecurityQuestion);
            setIsSecuritySetupComplete(loadedSecurityQuestion.answer.trim() !== '');

            // 6. ডার্ক মোড সেটিং লোড করুন
            const loadedDarkMode = await loadDarkModeSetting();
            setDarkModeEnabled(loadedDarkMode);

            // 7. স্ক্রলিং গতি সেটিং লোড করুন
            const savedScrollSpeed = await AsyncStorage.getItem(STORAGE_KEYS.SCROLL_SPEED);
            if (savedScrollSpeed) {
                setScrollSpeed(parseFloat(savedScrollSpeed));
            }

            // ডার্ক মোড অ্যাপ্লাই করুন
            if (loadedDarkMode) {
                setSettings(prev => ({
                    ...prev,
                    mainBgColor: DARK_MODE_COLORS.mainBgColor,
                    childBgColor: DARK_MODE_COLORS.childBgColor,
                    topBarColor: DARK_MODE_COLORS.topBarColor,
                    bottomBarColor: DARK_MODE_COLORS.bottomBarColor,
                    childTextColor: DARK_MODE_COLORS.textColor,
                    iconColor: DARK_MODE_COLORS.iconColor,
                    closeIconColor: DARK_MODE_COLORS.closeIconColor
                }));
            }

            // 8. নোটিফিকেশন সেটিং লোড করুন
            try {
                const notificationEnabled = await AsyncStorage.getItem(STORAGE_KEYS.NOTIFICATION_ENABLED);
                setEnableNotification(notificationEnabled === 'true');
            } catch (error) {
                console.error('Notification setting load error:', error);
            }

            // 9. ব্যাকআপ ডিরেক্টরি তৈরি করুন
            await createBackupDirectory();

            // 10. প্রথম লোডে ব্যাকআপ নোটিফিকেশন শো করুন
            setTimeout(() => {
                showBackupNotification();
            }, 1500);

            setIsAppLoaded(true);

        } catch (error) {
            console.error('Load all data error:', error);
            // ইমার্জেন্সি ফ্যালব্যাক
            setNotes([createNewNote(width - 100, 400)]);
            setIsAppLoaded(true);
        }
    };

    // স্ক্রলিং গতি সেভ করার ফাংশন
    const saveScrollSpeedSetting = async (speed) => {
        try {
            await AsyncStorage.setItem(STORAGE_KEYS.SCROLL_SPEED, speed.toString());
        } catch (error) {
            console.error('Save scroll speed error:', error);
        }
    };

    const loadSettingsWithFallback = async () => {
        try {
            // প্রথমে ব্যাকআপ ফাইল চেক করুন
            const backupSettings = await loadSettingsFromBackup();

            if (backupSettings) {
                return {
                    childTextColor: backupSettings.childTextColor || DEFAULT_TEXT_COLOR,
                    childTextSize: backupSettings.childTextSize || DEFAULT_TEXT_SIZE,
                    childBgColor: backupSettings.childBgColor || DEFAULT_CHILD_BG_COLOR,
                    mainBgColor: backupSettings.mainBgColor || DEFAULT_MAIN_BG_COLOR,
                    opacity: backupSettings.opacity || 0.9,
                    isLocked: backupSettings.isLocked || false,
                    topBarColor: backupSettings.topBarColor || '#f9e79f',
                    bottomBarColor: backupSettings.bottomBarColor || '#f9e79f',
                    iconColor: backupSettings.iconColor || '#444',
                    closeIconColor: backupSettings.closeIconColor || '#C0392B',
                };
            }

            // ব্যাকআপ না থাকলে AsyncStorage থেকে লোড করুন
            const savedSettings = await AsyncStorage.getItem(STORAGE_KEYS.SETTINGS);
            if (savedSettings) {
                const parsed = JSON.parse(savedSettings);
                return {
                    childTextColor: parsed.childTextColor || DEFAULT_TEXT_COLOR,
                    childTextSize: parsed.childTextSize || DEFAULT_TEXT_SIZE,
                    childBgColor: parsed.childBgColor || DEFAULT_CHILD_BG_COLOR,
                    mainBgColor: parsed.mainBgColor || DEFAULT_MAIN_BG_COLOR,
                    opacity: parsed.opacity || 0.9,
                    isLocked: parsed.isLocked || false,
                    topBarColor: parsed.topBarColor || '#f9e79f',
                    bottomBarColor: parsed.bottomBarColor || '#f9e79f',
                    iconColor: parsed.iconColor || '#444',
                    closeIconColor: parsed.closeIconColor || '#C0392B',
                };
            }
        } catch (error) {
            console.error('Settings load error:', error);
        }

        // সব ফেল করলে ডিফল্ট সেটিংস রিটার্ন করুন
        return {
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
        };
    };

    const saveSettingsToStorage = async (settingsToSave) => {
        try {
            // AsyncStorage তে সেভ
            await AsyncStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(settingsToSave));

            // ব্যাকআপ ফাইলে সেভ
            saveSettingsToBackup(settingsToSave).then(success => {
                console.log('Settings backup:', success);
            });
        } catch (error) {
            console.error('Save settings error:', error);
        }
    };

    // মাস্টার পাসওয়ার্ড সেভ এবং লোড
    const saveMasterPasswordToStorage = async (password, isSet) => {
        try {
            await AsyncStorage.setItem(STORAGE_KEYS.MASTER_PASSWORD, password);
            await AsyncStorage.setItem(STORAGE_KEYS.IS_PASSWORD_SET, isSet.toString());
        } catch (error) {
            console.error('Save master password error:', error);
        }
    };

    const loadMasterPasswordFromStorage = async () => {
        try {
            const savedPassword = await AsyncStorage.getItem(STORAGE_KEYS.MASTER_PASSWORD);
            const isPasswordSet = await AsyncStorage.getItem(STORAGE_KEYS.IS_PASSWORD_SET);

            return {
                password: savedPassword || '',
                isSet: isPasswordSet === 'true'
            };
        } catch (error) {
            console.error('Load master password error:', error);
            return { password: '', isSet: false };
        }
    };

    // সিকিউরিটি প্রশ্ন সেভ এবং লোড ফাংশন
    const saveSecurityQuestionToStorage = async (questionData) => {
        try {
            await AsyncStorage.setItem(STORAGE_KEYS.SECURITY_QUESTION, JSON.stringify(questionData));
        } catch (error) {
            console.error('Save security question error:', error);
        }
    };

    const loadSecurityQuestionFromStorage = async () => {
        try {
            const savedQuestion = await AsyncStorage.getItem(STORAGE_KEYS.SECURITY_QUESTION);
            if (savedQuestion) {
                const parsed = JSON.parse(savedQuestion);
                return {
                    question: parsed.question || SECURITY_QUESTIONS_LIST[0],
                    answer: parsed.answer || '',
                    encryptedAnswer: parsed.encryptedAnswer || ''
                };
            }
        } catch (error) {
            console.error('Load security question error:', error);
        }
        return {
            question: SECURITY_QUESTIONS_LIST[0],
            answer: '',
            encryptedAnswer: ''
        };
    };

    // এনক্রিপশন কী লোড বা জেনারেট
    const loadOrGenerateEncryptionKey = async () => {
        try {
            let key = await AsyncStorage.getItem(STORAGE_KEYS.ENCRYPTION_KEY);
            if (!key) {
                key = await generateEncryptionKey();
                await AsyncStorage.setItem(STORAGE_KEYS.ENCRYPTION_KEY, key);
            }
            return key;
        } catch (error) {
            console.error('Encryption key error:', error);
            const key = await generateEncryptionKey();
            return key;
        }
    };

    // ডার্ক মোড সেটিংস লোড
    const loadDarkModeSetting = async () => {
        try {
            const darkModeEnabled = await AsyncStorage.getItem(STORAGE_KEYS.DARK_MODE_ENABLED);
            return darkModeEnabled === 'true';
        } catch (error) {
            console.error('Dark mode load error:', error);
            return false;
        }
    };

    // ডার্ক মোড সেটিংস সেভ
    const saveDarkModeSetting = async (enabled) => {
        try {
            await AsyncStorage.setItem(STORAGE_KEYS.DARK_MODE_ENABLED, enabled.toString());
        } catch (error) {
            console.error('Dark mode save error:', error);
        }
    };

    // স্ক্রলিং গতি সেটিংস সেভ
    useEffect(() => {
        if (!isAppLoaded) return;

        saveScrollSpeedSetting(scrollSpeed);
    }, [scrollSpeed, isAppLoaded]);

    // ডার্ক মোড টগল ফাংশন
    const toggleDarkMode = async () => {
        const newDarkModeState = !darkModeEnabled;
        setDarkModeEnabled(newDarkModeState);
        await saveDarkModeSetting(newDarkModeState);

        // সেটিংস আপডেট করুন
        if (newDarkModeState) {
            setSettings(prev => ({
                ...prev,
                mainBgColor: DARK_MODE_COLORS.mainBgColor,
                childBgColor: DARK_MODE_COLORS.childBgColor,
                topBarColor: DARK_MODE_COLORS.topBarColor,
                bottomBarColor: DARK_MODE_COLORS.bottomBarColor,
                childTextColor: DARK_MODE_COLORS.textColor,
                iconColor: DARK_MODE_COLORS.iconColor,
                closeIconColor: DARK_MODE_COLORS.closeIconColor
            }));
        } else {
            setSettings(prev => ({
                ...prev,
                mainBgColor: LIGHT_MODE_COLORS.mainBgColor,
                childBgColor: LIGHT_MODE_COLORS.childBgColor,
                topBarColor: LIGHT_MODE_COLORS.topBarColor,
                bottomBarColor: LIGHT_MODE_COLORS.bottomBarColor,
                childTextColor: LIGHT_MODE_COLORS.textColor,
                iconColor: LIGHT_MODE_COLORS.iconColor,
                closeIconColor: LIGHT_MODE_COLORS.closeIconColor
            }));
        }
    };

    // --- স্টোরেজ লোড করা ---
    useEffect(() => {
        loadAllData();

        // অ্যাপ স্টেট চেঞ্জ হ্যান্ডলার
        const subscription = AppState.addEventListener('change', nextAppState => {
            if (nextAppState === 'active') {
                // অ্যাপ ফোরগ্রাউন্ডে এলে ডেটা রিফ্রেশ করতে পারেন
                if (isAppLoaded) {
                    console.log('App came to foreground');
                }
            }
        });

        return () => {
            subscription.remove();
            if (scrollMomentumTimeoutRef.current) {
                clearTimeout(scrollMomentumTimeoutRef.current);
            }
        };
    }, []);

    // মাস্টার পাসওয়ার্ড সেভ করা
    useEffect(() => {
        if (masterPassword !== undefined && isAppLoaded) {
            saveMasterPasswordToStorage(masterPassword, isPasswordSet);
        }
    }, [masterPassword, isPasswordSet, isAppLoaded]);

    // নোটিফিকেশন সেটিংস সেভ করা
    useEffect(() => {
        if (!isAppLoaded) return;

        const saveNotificationSetting = async () => {
            try {
                await AsyncStorage.setItem(
                    STORAGE_KEYS.NOTIFICATION_ENABLED,
                    enableNotification.toString()
                );
            } catch (error) {
                console.error('Save notification setting error:', error);
            }
        };

        saveNotificationSetting();
    }, [enableNotification, isAppLoaded]);

    // ডার্ক মোড সেটিংস সেভ করা
    useEffect(() => {
        if (!isAppLoaded) return;

        saveDarkModeSetting(darkModeEnabled);
    }, [darkModeEnabled, isAppLoaded]);

    // --- নোটস সেভ করা যখন পরিবর্তন হয় ---
    useEffect(() => {
        if (!isAppLoaded || notes.length === 0) return;

        saveNotesToStorage(notes);
    }, [notes, isAppLoaded]);

    // --- সেটিংস সেভ করা যখন পরিবর্তন হয় ---
    useEffect(() => {
        if (!isAppLoaded) return;

        saveSettingsToStorage(settings);
    }, [settings, isAppLoaded]);

    // সিকিউরিটি প্রশ্ন সেভ করা
    useEffect(() => {
        if (!isAppLoaded) return;

        if (securityQuestion) {
            saveSecurityQuestionToStorage(securityQuestion);
        }
    }, [securityQuestion, isAppLoaded]);

    // --- নোটিফিকেশন ফাংশনগুলি ---
    const requestNotificationPermission = async () => {
        try {
            const { status } = await checkNotifications();
            if (status !== RESULTS.GRANTED) {
                const { status: newStatus } = await requestNotifications(['alert', 'sound']);
                return newStatus === RESULTS.GRANTED;
            }
            return true;
        } catch (error) {
            console.error('Notification permission error:', error);
            return false;
        }
    };

    const showPersistentNotification = async () => {
        try {
            const hasPermission = await requestNotificationPermission();
            if (!hasPermission) {
                Alert.alert(
                    "Permission Required",
                    "Please enable notifications in settings to use quick launch feature.",
                    [{ text: "OK" }]
                );
                return false;
            }

            // React Native CLI তে persistent notification এর জন্য native module প্রয়োজন
            // এখানে শুধু permission চেক করে message দেখানো হচ্ছে
            Alert.alert(
                "Notification Feature",
                "Quick launch notification would be shown here. For full notification support, please implement native notification module.",
                [{ text: "OK" }]
            );

            return true;
        } catch (error) {
            console.error('Notification error:', error);
            Alert.alert(
                "Notification Error",
                "Could not show notification. Please check notification permissions."
            );
            return false;
        }
    };

    const hidePersistentNotification = async () => {
        try {
            // React Native CLI তে notification cancel করার জন্য native module প্রয়োজন
            return true;
        } catch (error) {
            console.error('Hide notification error:', error);
            return false;
        }
    };

    // --- সরলীকৃত কার্সার পজিশন হ্যান্ডলার ---
    const handleCursorPosition = useCallback((position) => {
        lastCursorPosRef.current = position;
        setSelection({ start: position, end: position });
    }, []);

    // --- উন্নত স্ক্রল সিঙ্ক্রোনাইজেশন ---
    const handleScrollSync = useCallback((event) => {
        const scrollY = event.nativeEvent.contentOffset.y;
        currentScrollYRef.current = scrollY;

        // উন্নত Fast scroll indicator দেখানো - আরও দ্রুত
        if (!showFastScroll) {
            setShowFastScroll(true);
            Animated.timing(scrollIndicatorOpacity, {
                toValue: 1,
                duration: 150,
                useNativeDriver: true,
            }).start();
        }

        // Fast scroll indicator hide করার টাইমার রিসেট - 3 সেকেন্ড
        if (fastScrollTimeoutRef.current) {
            clearTimeout(fastScrollTimeoutRef.current);
        }
        fastScrollTimeoutRef.current = setTimeout(() => {
            Animated.timing(scrollIndicatorOpacity, {
                toValue: 0,
                duration: 400,
                useNativeDriver: true,
            }).start(() => setShowFastScroll(false));
        }, 3000);

        // ইন্ডিকেটর পজিশন আপডেট - ভিউ মোড এবং এডিট মোড উভয়ক্ষেত্রে
        if (scrollViewContentHeightRef.current && scrollViewVisibleHeightRef.current) {
            const maxScroll = Math.max(1, scrollViewContentHeightRef.current - scrollViewVisibleHeightRef.current);
            const progress = scrollY / maxScroll;
            const indicatorPosition = progress * (scrollViewVisibleHeightRef.current - 40);
            fastScrollIndicatorY.setValue(indicatorPosition);
        }
    }, [showFastScroll]);

    // --- উন্নত Fast Scroll Handler - ভিউ এবং এডিট মোড উভয়ের জন্য ---
    const handleFastScroll = useCallback((gestureState) => {
        const scrollableHeight = Math.max(1, scrollViewContentHeightRef.current - scrollViewVisibleHeightRef.current);

        // স্ক্রল স্পীড মাল্টিপ্লায়ার অ্যাপ্লাই করুন
        const speedMultiplier = scrollSpeed || 1.0;
        const fastScrollProgress = clamp(gestureState.dy / 500, -1, 1) * speedMultiplier;

        // Calculate new scroll position
        const currentScrollY = currentScrollYRef.current;
        const scrollIncrement = scrollableHeight * fastScrollProgress * 0.08; // 0.05 থেকে 0.08 এ ইনক্রিজ
        const newScrollY = clamp(currentScrollY + scrollIncrement, 0, scrollableHeight);

        // Update scroll position
        currentScrollYRef.current = newScrollY;

        if (isViewingMode) {
            scrollViewRef.current?.scrollTo?.({ y: newScrollY, animated: false });
        } else {
            editScrollViewRef.current?.scrollTo?.({ y: newScrollY, animated: false });
        }

        // Update fast scroll indicator position
        const progress = newScrollY / scrollableHeight;
        const indicatorPosition = progress * (scrollViewVisibleHeightRef.current - 40);
        fastScrollIndicatorY.setValue(indicatorPosition);
    }, [isViewingMode, scrollSpeed]);

    // --- উন্নত Fast Scroll Pan Responder - ভিউ এবং এডিট মোড উভয়ের জন্য ---
    const fastScrollResponder = useRef(
        PanResponder.create({
            onStartShouldSetPanResponder: () => true,
            onMoveShouldSetPanResponder: () => true,
            onPanResponderGrant: (e, gestureState) => {
                isFastScrolling.current = true;
                scrollIndicatorOpacity.setValue(1);
            },
            onPanResponderMove: (_, gestureState) => {
                handleFastScroll(gestureState);
            },
            onPanResponderRelease: () => {
                isFastScrolling.current = false;
                if (fastScrollTimeoutRef.current) {
                    clearTimeout(fastScrollTimeoutRef.current);
                }
                fastScrollTimeoutRef.current = setTimeout(() => {
                    Animated.timing(scrollIndicatorOpacity, {
                        toValue: 0,
                        duration: 400,
                        useNativeDriver: true,
                    }).start(() => setShowFastScroll(false));
                }, 3000);
            },
            onPanResponderTerminate: () => {
                isFastScrolling.current = false;
            },
        })
    ).current;

    // --- উন্নত Rapid Text Selection Handlers ---
    const startRapidTextSelection = useCallback((direction) => {
        if (textSelectionIntervalRef.current) {
            clearInterval(textSelectionIntervalRef.current);
        }

        selectionDirectionRef.current = direction;
        isSelectingText.current = true;

        const selectionSpeed = 25;
        const intervalTime = 16;

        textSelectionIntervalRef.current = setInterval(() => {
            setSelection(prev => {
                const currentContent = history.current;
                let newStart = prev.start;
                let newEnd = prev.end;

                if (direction === 'down') {
                    newEnd = Math.min(currentContent.length, newEnd + selectionSpeed);
                } else if (direction === 'up') {
                    newStart = Math.max(0, newStart - selectionSpeed);
                }

                lastCursorPosRef.current = direction === 'down' ? newEnd : newStart;

                return { start: newStart, end: newEnd };
            });
        }, intervalTime);
    }, [history.current]);

    const stopRapidTextSelection = useCallback(() => {
        if (textSelectionIntervalRef.current) {
            clearInterval(textSelectionIntervalRef.current);
            textSelectionIntervalRef.current = null;
        }
        isSelectingText.current = false;
        selectionDirectionRef.current = null;
        isInTextSelectionMode.current = false;
    }, []);

    // --- উন্নত Text Selection Handlers ---
    const handleTextSelection = useCallback((start, end) => {
        selectionStartPosRef.current = start;
        setSelection({ start, end });
        lastCursorPosRef.current = end;
    }, []);

    // --- উন্নত Text Selection Change Handler ---
    const handleSelectionChange = useCallback((e) => {
        const { start, end } = e.nativeEvent.selection;

        if (start === end) {
            handleCursorPosition(start);
        } else {
            handleTextSelection(start, end);
        }

        setSelection({ start, end });
    }, [handleCursorPosition, handleTextSelection]);

    // --- উন্নত Text Selection Gesture Handler ---
    const handleTextSelectionGesture = useCallback((gestureState) => {
        if (!isInTextSelectionMode.current) return;

        const currentY = gestureState.moveY;
        const deltaY = currentY - lastSelectionYRef.current;

        if (Math.abs(deltaY) > 2) {
            const direction = deltaY > 0 ? 'down' : 'up';

            if (!isSelectingText.current || selectionDirectionRef.current !== direction) {
                if (isSelectingText.current) {
                    stopRapidTextSelection();
                }
                startRapidTextSelection(direction);
            }

            lastSelectionYRef.current = currentY;
        }
    }, [startRapidTextSelection, stopRapidTextSelection]);

    // --- Text Selection Pan Responder ---
    const textSelectionResponder = useRef(
        PanResponder.create({
            onStartShouldSetPanResponder: () => isInTextSelectionMode.current,
            onMoveShouldSetPanResponder: () => isInTextSelectionMode.current,
            onPanResponderGrant: () => {
                // Text selection mode started
            },
            onPanResponderMove: (_, gestureState) => {
                handleTextSelectionGesture(gestureState);
            },
            onPanResponderRelease: () => {
                stopRapidTextSelection();
            },
            onPanResponderTerminate: () => {
                stopRapidTextSelection();
            },
        })
    ).current;

    // --- বাবল ডিলিট কনফার্মেশন ---
    const showDeleteConfirmation = useCallback(() => {
        setShowDeleteConfirm(true);
        Animated.timing(deleteConfirmAnim, {
            toValue: 1,
            duration: 350,
            useNativeDriver: true,
        }).start();
    }, []);
    
    // --- Overlay Module functions ---
// --- Overlay Module functions ---
const startFloatingBubble = useCallback(async () => {
    try {
        const { OverlayModule } = require('react-native').NativeModules;
        if (OverlayModule) {
            const result = await OverlayModule.startBubble();
            console.log('Bubble started:', result);
            // শুধু সফল হলে toast দেখান, alert নয়
            Toast.show('Floating bubble activated!', Toast.SHORT);
        } else {
            console.log('Overlay module not available');
        }
    } catch (error) {
        console.error('Start bubble error:', error);
    }
}, []);

const stopFloatingBubble = useCallback(async () => {
    try {
        const { OverlayModule } = require('react-native').NativeModules;
        if (OverlayModule) {
            const result = await OverlayModule.stopBubble();
            console.log('Bubble stopped:', result);
        }
    } catch (error) {
        console.error('Stop bubble error:', error);
    }
}, []);

const checkOverlayPermission = useCallback(async () => {
    try {
        const { OverlayModule } = require('react-native').NativeModules;
        if (OverlayModule) {
            const hasPermission = await OverlayModule.checkOverlayPermission();
            console.log('Has overlay permission:', hasPermission);
            setHasOverlayPermission(hasPermission);
            return hasPermission;
        }
        return false;
    } catch (error) {
        console.error('Check permission error:', error);
        return false;
    }
}, []);

    const hideDeleteConfirmation = useCallback(() => {
        Animated.timing(deleteConfirmAnim, {
            toValue: 0,
            duration: 200,
            useNativeDriver: true,
        }).start(() => setShowDeleteConfirm(false));
    }, []);

    const handleBubbleDelete = useCallback(() => {
        hideDeleteConfirmation();
        setShowNote(false);
        setActiveNoteId(null);
        setNotes([createNewNote(width - 100, 400)]);
        Alert.alert("Success", "All notes have been deleted.");
    }, []);

    // --- উন্নত বাবল Pan Responder ---
    const bubbleResponder = useRef(
        PanResponder.create({
            onStartShouldSetPanResponder: () => true,
            onPanResponderGrant: () => {
                bubblePan.stopAnimation();
                bubblePan.setOffset({ x: bubblePan.x.__getValue(), y: bubblePan.y.__getValue() });
                bubblePan.setValue({ x: 0, y: 0 });
                isDragging.current = false;

                // ড্রাগ শুরু করলেই ডিলিট কনফার্মেশন শো করবে
                showDeleteConfirmation();
            },
            onPanResponderMove: (e, gestureState) => {
                bubblePan.x.setValue(gestureState.dx);
                bubblePan.y.setValue(gestureState.dy);
                if (Math.abs(gestureState.dx) > 2 || Math.abs(gestureState.dy) > 2) {
                    isDragging.current = true;
                }
            },
            onPanResponderRelease: (_, gesture) => {
                bubblePan.flattenOffset();

                const finalX = bubblePan.x.__getValue();
                const finalY = bubblePan.y.__getValue();

                if (isDragging.current) {
                    // বাবল স্ক্রিনের 15% এর বেশি হাইড হবে না
                    let adjustedX = finalX;
                    let adjustedY = finalY;

                    // X-অক্ষে 15% এর বেশি হাইড হবে না
                    if (finalX < -(BUBBLE_SIZE * 0.15)) {
                        adjustedX = -(BUBBLE_SIZE * 0.15);
                    } else if (finalX > width - (BUBBLE_SIZE * 0.85)) {
                        adjustedX = width - (BUBBLE_SIZE * 0.85);
                    }

                    // Y-অক্ষে 15% এর বেশি হাইড হবে না  
                    if (finalY < -(BUBBLE_SIZE * 0.15)) {
                        adjustedY = -(BUBBLE_SIZE * 0.15);
                    } else if (finalY > height - (BUBBLE_SIZE * 0.85)) {
                        adjustedY = height - (BUBBLE_SIZE * 0.85);
                    }

                    // বাবল অবস্থান সেভ করা
                    bubblePositionRef.current = { x: adjustedX, y: adjustedY };

                    // যদি ডিলিট জোনে ছেড়ে দেওয়া হয় (নিচের 15% এরিয়া)
                    if (finalY > height * 0.85) {
                        handleBubbleDelete();
                    } else {
                        // বাবলকে এডজাস্ট করা অবস্থানে নিয়ে যাওয়া
                        Animated.spring(bubblePan, {
                            toValue: { x: adjustedX, y: adjustedY },
                            friction: 6,
                            tension: 40,
                            useNativeDriver: false,
                        }).start(() => {
                            hideDeleteConfirmation();
                        });
                    }
                } else {
                    openFromBubble();
                    hideDeleteConfirmation();
                }

                // ড্রাগ শেষ হলে হাইড করবে (যদি ডিলিট না হয়)
                if (finalY <= height * 0.85) {
                    hideDeleteConfirmation();
                }
            },
            onPanResponderTerminate: () => {
                hideDeleteConfirmation();
            },
        })
    ).current;

    // --- Core Note Management Functions ---

    const savePositions = useCallback(() => {
        if (!activeNoteId) return;

        const newCursorPos = lastCursorPosRef.current;
        const newScrollY = currentScrollYRef.current;

        setNotes(prevNotes =>
            prevNotes.map(note =>
                note.id === activeNoteId
                    ? {
                        ...note,
                        lastCursorPos: newCursorPos,
                        lastScrollY: newScrollY
                    }
                    : note
            )
        );
    }, [activeNoteId]);

    const updateActiveNoteState = (newContent, shouldUpdateHistory = true) => {
        setIsSaving(true);

        if (saveTimerRef.current) {
            clearTimeout(saveTimerRef.current);
        }

        saveTimerRef.current = setTimeout(() => {
            setIsSaving(false);
        }, 500);

        const lines = newContent.split('\n');
        const newTitle = lines[0].trim().substring(0, 50) || 'Untitled Note';
        const newPreview = newContent.split('\n')[0].substring(0, 50) || '';

        setNotes(prevNotes => {
            let updatedNote = null;
            const remainingNotes = prevNotes.filter(note => {
                if (note.id === activeNoteId) {
                    updatedNote = {
                        ...note,
                        content: newContent,
                        title: newTitle,
                        preview: newPreview,
                        lastEdited: Date.now(),
                        lastCursorPos: lastCursorPosRef.current,
                        lastScrollY: currentScrollYRef.current
                    };
                    return false;
                }
                return true;
            });

            if (updatedNote) {
                return [updatedNote, ...remainingNotes];
            }
            return prevNotes;
        });

        if (shouldUpdateHistory) {
            setHistory(prev => {
                const past = [...prev.past, prev.current];
                return {
                    past: past.slice(-50),
                    current: newContent,
                    future: [],
                };
            });
        } else {
            setHistory(prev => ({
                ...prev,
                current: newContent,
            }));
        }
    };

    const updateActiveNoteContent = (newContent) => {
        updateActiveNoteState(newContent);
    };

    const handleCopy = () => {
        if (activeNote) {
            Clipboard.setString(activeNote.content);
            Alert.alert("Copied", "Note content copied to clipboard.");
        }
    };

    const handlePaste = async () => {
        try {
            const pastedText = await Clipboard.getString();
            if (pastedText) {
                const currentContent = history.current;
                const { start, end } = selection;

                const newContent = currentContent.slice(0, start) + pastedText + currentContent.slice(end);

                updateActiveNoteState(newContent);

                const newCursorPosition = start + pastedText.length;

                handleCursorPosition(newCursorPosition);

                Alert.alert("Pasted", "Content pasted successfully.");

                if (isViewingMode) {
                    setIsViewingMode(false);
                }
            }
        } catch (error) {
            Alert.alert("Error", "Failed to paste content.");
        }
    };

    // --- UNDO/REDO ফাংশনালিটি ---
    const handleUndo = () => {
        if (history.past.length > 0) {
            const previousContent = history.past[history.past.length - 1];
            const newPast = history.past.slice(0, -1);

            setHistory({
                past: newPast,
                current: previousContent,
                future: [history.current, ...history.future]
            });

            updateActiveNoteState(previousContent, false);
            Alert.alert("Undo", "Last action undone.");
        } else {
            Alert.alert("Info", "Nothing to undo.");
        }
    };

    const handleRedo = () => {
        if (history.future.length > 0) {
            const nextContent = history.future[0];
            const newFuture = history.future.slice(1);

            setHistory({
                past: [...history.past, history.current],
                current: nextContent,
                future: newFuture
            });

            updateActiveNoteState(nextContent, false);
            Alert.alert("Redo", "Action redone.");
        } else {
            Alert.alert("Info", "Nothing to redo.");
        }
    };

    // --- SHARE ফাংশনালিটি ---
    const handleShare = async () => {
        if (!activeNote) return;

        try {
            const result = await Share.share({
                message: `${activeNote.title}\n\n${activeNote.content}\n\nShared from Floating Notes App`,
                title: activeNote.title
            });

            if (result.action === Share.sharedAction) {
                if (result.activityType) {
                    // শেয়ার সফল
                } else {
                    // শেয়ার সফল
                }
            } else if (result.action === Share.dismissedAction) {
                // শেয়ার বাতিল
            }
        } catch (error) {
            Alert.alert("Error", "Failed to share note.");
        }
    };

    // --- ফুল স্ক্রিন টগল ফাংশন ---
    const handleToggleFullScreen = () => {
        if (isFullScreen) {
            // ফুল স্ক্রিন থেকে ফ্লোটিং নোট মোডে ফিরে যাওয়া
            const currentW = DEFAULT_NOTE_WIDTH;
            const currentH = DEFAULT_NOTE_HEIGHT;
            const currentX = (width - DEFAULT_NOTE_WIDTH) / 2;
            const currentY = (height - DEFAULT_NOTE_HEIGHT) / 3;

            Animated.parallel([
                Animated.spring(noteWidth, {
                    toValue: currentW,
                    friction: 8,
                    tension: 40,
                    useNativeDriver: false,
                }),
                Animated.spring(noteHeight, {
                    toValue: currentH,
                    friction: 8,
                    tension: 40,
                    useNativeDriver: false,
                }),
                Animated.spring(notePan, {
                    toValue: { x: currentX, y: currentY },
                    friction: 8,
                    tension: 40,
                    useNativeDriver: false,
                }),
            ]).start();
        } else {
            // ফ্লোটিং নোট থেকে ফুল স্ক্রিন মোডে যাওয়া
            Animated.parallel([
                Animated.spring(noteWidth, {
                    toValue: width - 20,
                    friction: 8,
                    tension: 40,
                    useNativeDriver: false,
                }),
                Animated.spring(noteHeight, {
                    toValue: height - 80,
                    friction: 8,
                    tension: 40,
                    useNativeDriver: false,
                }),
                Animated.spring(notePan, {
                    toValue: { x: 10, y: 40 },
                    friction: 8,
                    tension: 40,
                    useNativeDriver: false,
                }),
            ]).start();
        }

        setIsFullScreen(!isFullScreen);
    };

    const handleCreateNewNote = () => {
        const currentX = notePan.x.__getValue() || (width - DEFAULT_NOTE_WIDTH) / 2;
        const currentY = notePan.y.__getValue() || (height - DEFAULT_NOTE_HEIGHT) / 2;
        const newNote = createNewNote(currentX, currentY);
        setNotes(prev => [newNote, ...prev]);
        handleOpenNote(newNote.id);
    };

    const handleDeleteNote = (id) => {
        const noteToDelete = notes.find(n => n.id === id);

        Alert.alert(
            "Delete Note",
            `আপনি কি নিশ্চিতভাবে এই নোটটি ("${noteToDelete?.title || 'Untitled Note'}") মুছে ফেলতে চান?`,
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Delete",
                    onPress: () => {
                        setNotes(prev => prev.filter(note => note.id !== id));
                        if (activeNoteId === id) {
                            setActiveNoteId(null);
                            setIsNoteTemporarilyUnlockedId(null);
                        }
                    },
                    style: "destructive"
                },
            ]
        );
    };

    const handleOpenNote = (id) => {
        const noteToOpen = notes.find(n => n.id === id);

        if (noteToOpen && noteToOpen.isLocked) {
            // লক করা নোট - শুধু পাসওয়ার্ড মোডাল দেখাবে, নোট ওপেন হবে না
            setActiveNoteId(id);
            setPasswordModalVisible(true);
            setShowNote(false);
            return;
        } else {
            setIsNoteTemporarilyUnlockedId(id);
            setActiveNoteId(id);
            setIsViewingMode(true);
            setShowNote(true);
        }

        if (noteToOpen) {
            const initialCursorPos = noteToOpen.lastCursorPos || 0;
            const initialScrollY = noteToOpen.lastScrollY || 0;

            lastCursorPosRef.current = initialCursorPos;
            currentScrollYRef.current = initialScrollY;

            handleCursorPosition(initialCursorPos);
        }
    };

    const lockNoteIfNecessary = (id) => {
        // শুধুমাত্র ম্যানুয়ালি লক করলে লক হবে
    };

    const handlePasswordSubmit = () => {
        // মাস্টার পাসওয়ার্ড চেক
        if (tempPassword === masterPassword) {
            setIsNoteTemporarilyUnlockedId(activeNoteId);
            setPasswordModalVisible(false);
            setTempPassword('');

            const unlockedNote = notes.find(n => n.id === activeNoteId);
            if (unlockedNote) {
                setHistory({ past: [], current: unlockedNote.content, future: [] });

                const initialCursorPos = unlockedNote.lastCursorPos || 0;
                const initialScrollY = unlockedNote.lastScrollY || 0;

                lastCursorPosRef.current = initialCursorPos;
                currentScrollYRef.current = initialScrollY;

                handleCursorPosition(initialCursorPos);
                setShowNote(true);
            }
        } else {
            Alert.alert("Error", "ভুল মাস্টার পাসওয়ার্ড। আবার চেষ্টা করুন।");
            setTempPassword('');
            setActiveNoteId(null);
            setPasswordModalVisible(false);
        }
    };

    const handleSetPasswordSubmit = () => {
        if (newMasterPasswordInput.length < 3) {
            Alert.alert("Error", "Password must be at least 3 characters long.");
            return;
        }

        setMasterPassword(newMasterPasswordInput);
        setIsPasswordSet(true);
        setIsChangePasswordModalVisible(false);
        setNewMasterPasswordInput('');

        Alert.alert(
            "Success",
            "Password set successfully!\n\nNow please set up a security question for password recovery.",
            [
                {
                    text: "Setup Security Question",
                    onPress: () => {
                        setIsSecurityQuestionSetupModalVisible(true);
                    }
                }
            ]
        );
    };

    const handlePasswordChangeSubmit = () => {
        // ওল্ড পাসওয়ার্ড চেক
        if (oldMasterPasswordInput !== masterPassword) {
            Alert.alert("Error", "Old Password is incorrect.");
            return;
        }

        if (newMasterPasswordInput.length < 3) {
            Alert.alert("Error", "New password must be at least 3 characters long.");
            return;
        }

        setMasterPassword(newMasterPasswordInput);
        setIsChangePasswordModalVisible(false);
        setOldMasterPasswordInput('');
        setNewMasterPasswordInput('');
        Alert.alert("Success", "Password changed successfully!");
    };

    // --- সিকিউরিটি প্রশ্ন ফাংশনগুলি ---
    const handleSetupSecurityQuestion = async () => {
        if (securityQuestion.answer.trim() === '') {
            Alert.alert("Error", "Please answer the security question.");
            return;
        }

        try {
            const encryptedAnswer = await encryptData(securityQuestion.answer, encryptionKey);
            const updatedQuestion = {
                ...securityQuestion,
                encryptedAnswer: encryptedAnswer || ''
            };

            setSecurityQuestion(updatedQuestion);
            setIsSecuritySetupComplete(true);
            setIsSecurityQuestionSetupModalVisible(false);

            Alert.alert(
                "Success",
                isSecuritySetupComplete
                    ? "Security question has been updated successfully!"
                    : "Security question has been set up successfully!\n\nPlease remember your answer - you will need it to recover your password.",
                [{ text: "OK" }]
            );
        } catch (error) {
            Alert.alert("Error", "Failed to save security question.");
        }
    };

    const handleUpdateSecurityQuestionFlow = () => {
        if (isSecuritySetupComplete) {
            setIsSecurityQuestionModalVisibleForUpdate(true);
            setIsSecurityQuestionModalVisible(true);
        } else {
            setIsSecurityQuestionSetupModalVisible(true);
        }
    };

    const handleVerifySecurityAnswer = async () => {
        if (securityAnswerInput.trim() === '') {
            Alert.alert("Error", "Please answer the security question.");
            return;
        }

        try {
            const encryptedUserAnswer = await encryptData(securityAnswerInput, encryptionKey);
            const isCorrect = encryptedUserAnswer === securityQuestion.encryptedAnswer;

            if (isCorrect) {
                setIsSecurityQuestionModalVisible(false);
                setSecurityAnswerInput('');

                Alert.alert(
                    "Verified Successfully",
                    "Old security answer verified! Now you can set a new security question.",
                    [
                        {
                            text: "Set New Security Question",
                            onPress: () => {
                                setSecurityQuestion(prev => ({
                                    ...prev,
                                    answer: '',
                                    encryptedAnswer: ''
                                }));
                                setIsSecuritySetupComplete(false);
                                setIsSecurityQuestionSetupModalVisible(true);
                            }
                        }
                    ]
                );
            } else {
                Alert.alert("Error", "Security answer is incorrect.");
                setSecurityAnswerInput('');
            }
        } catch (error) {
            Alert.alert("Error", "Failed to verify security answer.");
        }
    };

    const handleVerifySecurityAnswerForForget = async () => {
        if (securityAnswerInput.trim() === '') {
            Alert.alert("Error", "Please answer the security question.");
            return;
        }

        try {
            const encryptedUserAnswer = await encryptData(securityAnswerInput, encryptionKey);
            const isCorrect = encryptedUserAnswer === securityQuestion.encryptedAnswer;

            if (isCorrect) {
                setIsSecurityQuestionModalVisible(false);
                setIsRecoveryPasswordModalVisible(true);
                setSecurityAnswerInput('');
            } else {
                Alert.alert("Error", "Security answer is incorrect.");
                setSecurityAnswerInput('');
            }
        } catch (error) {
            Alert.alert("Error", "Failed to verify security answer.");
        }
    };

    const handleRecoveryPasswordSubmit = () => {
        if (recoveryPasswordInput.length < 3) {
            Alert.alert("Error", "New password must be at least 3 characters long.");
            return;
        }

        setMasterPassword(recoveryPasswordInput);
        setIsPasswordSet(true);
        setIsRecoveryPasswordModalVisible(false);
        setRecoveryPasswordInput('');

        Alert.alert(
            "Success",
            "Password recovered successfully!\n\nYour new master password has been set.",
            [{ text: "OK" }]
        );
    };

    const handleForgetPassword = () => {
        if (!isSecuritySetupComplete) {
            Alert.alert(
                "Security Not Set Up",
                "You haven't set up a security question yet. Please set it up first.",
                [
                    {
                        text: "Set Up Now",
                        onPress: () => setIsSecurityQuestionSetupModalVisible(true)
                    },
                    { text: "Cancel", style: "cancel" }
                ]
            );
            return;
        }

        Alert.alert(
            "Forgot Password?",
            "Please answer your security question to reset your password.",
            [
                {
                    text: "Answer Security Question",
                    onPress: () => {
                        setSecurityAnswerInput('');
                        setIsSecurityQuestionModalVisible(true);
                    }
                },
                { text: "Cancel", style: "cancel" }
            ]
        );
    };

    const toggleNoteLock = (id) => {
        const noteToLock = notes.find(n => n.id === id);

        if (!noteToLock) return;

        if (noteToLock.isLocked) {
            setNotes(prevNotes =>
                prevNotes.map(note =>
                    note.id === id
                        ? { ...note, isLocked: false }
                        : note
                )
            );
            Alert.alert("Success", `নোট "${noteToLock.title}" আনলক করা হয়েছে।`);
        } else {
            if (!isPasswordSet) {
                Alert.alert(
                    "Password Not Set",
                    "You need to set a password first to lock notes. Go to Settings > Security to set up your password.",
                    [
                        { text: "Cancel", style: "cancel" },
                        {
                            text: "Go to Settings",
                            onPress: () => {
                                setIsSettingsVisible(true);
                            }
                        }
                    ]
                );
                return;
            }

            Alert.alert(
                "Lock Note",
                `আপনি কি নিশ্চিত নোট "${noteToLock.title}" লক করতে চান?`,
                [
                    { text: "Cancel", style: "cancel" },
                    {
                        text: "Lock",
                        onPress: () => {
                            setNotes(prevNotes =>
                                prevNotes.map(note =>
                                    note.id === id
                                        ? { ...note, isLocked: true }
                                        : note
                                )
                            );
                            if (activeNoteId === id) {
                                handleClose(true);
                            }
                        },
                        style: "destructive",
                    },
                ]
            );
        }
    };

    const handleMoveNote = (id, direction) => {
        setNotes(prevNotes => {
            const index = prevNotes.findIndex(n => n.id === id);
            if (index === -1) return prevNotes;

            let newIndex = index;
            if (direction === 'up' && index > 0) {
                newIndex = index - 1;
            } else if (direction === 'down' && index < prevNotes.length - 1) {
                newIndex = index + 1;
            } else {
                return prevNotes;
            }

            const newNotes = [...prevNotes];
            [newNotes[index], newNotes[newIndex]] = [newNotes[newIndex], newNotes[index]];
            return newNotes;
        });
    };

    const handleSettingsSave = () => {
        setSettings(prev => ({
            ...prev
        }));
        setIsSettingsVisible(false);
        Alert.alert("Success", "Settings saved successfully.");
    };

    const handleSettingsCancel = () => {
        setIsSettingsVisible(false);
    };

    // --- Dragging, Resizing, and Minimizing Logic ---
    const openFromBubble = () => {
        const isListMode = activeNoteId === null;

        let currentW, currentH, currentX, currentY;

        if (openFromBubble.shouldResetPosition) {
            openFromBubble.shouldResetPosition = false;

            currentW = DEFAULT_NOTE_WIDTH;
            currentH = DEFAULT_NOTE_HEIGHT;
            currentX = (width - DEFAULT_NOTE_WIDTH) / 2;
            currentY = (height - DEFAULT_NOTE_HEIGHT) / 3;

            if (notes.length > 0) {
                setNotes(prevNotes =>
                    prevNotes.map((n, i) =>
                        i === 0
                            ? { ...n, lastX: currentX, lastY: currentY, lastW: currentW, lastH: currentH }
                            : n
                    )
                );
            }
        } else if (!openFromBubble.hasOpenedOnce) {
            openFromBubble.hasOpenedOnce = true;

            currentW = DEFAULT_NOTE_WIDTH;
            currentH = DEFAULT_NOTE_HEIGHT;
            currentX = (width - DEFAULT_NOTE_WIDTH) / 2;
            currentY = (height - DEFAULT_NOTE_HEIGHT) / 3;

            setNotes(prevNotes =>
                prevNotes.map((n, i) =>
                    i === 0
                        ? { ...n, lastX: currentX, lastY: currentY, lastW: currentW, lastH: currentH }
                        : n
                )
            );
        } else if (activeNote && notePositionBeforeMinimizeRef.current.x !== undefined) {
            currentW = notePositionBeforeMinimizeRef.current.width;
            currentH = notePositionBeforeMinimizeRef.current.height;
            currentX = notePositionBeforeMinimizeRef.current.x;
            currentY = notePositionBeforeMinimizeRef.current.y;
        } else if (activeNote) {
            currentW = activeNote.lastW || DEFAULT_NOTE_WIDTH;
            currentH = activeNote.lastH || DEFAULT_NOTE_HEIGHT;
            currentX = activeNote.lastX || (width - DEFAULT_NOTE_WIDTH) / 2;
            currentY = activeNote.lastY || (height - DEFAULT_NOTE_HEIGHT) / 3;
        } else if (notePositionBeforeMinimizeRef.current.x !== undefined) {
            currentW = notePositionBeforeMinimizeRef.current.width;
            currentH = notePositionBeforeMinimizeRef.current.height;
            currentX = notePositionBeforeMinimizeRef.current.x;
            currentY = notePositionBeforeMinimizeRef.current.y;
        } else {
            currentW = DEFAULT_NOTE_WIDTH;
            currentH = DEFAULT_NOTE_HEIGHT;
            currentX = (width - DEFAULT_NOTE_WIDTH) / 2;
            currentY = (height - DEFAULT_NOTE_HEIGHT) / 3;
        }

        noteWidth.setValue(currentW);
        noteHeight.setValue(currentH);

        const bubbleCenterX = bubblePan.x.__getValue() + BUBBLE_SIZE / 2;
        const bubbleCenterY = bubblePan.y.__getValue() + BUBBLE_SIZE / 2;

        notePan.setValue({
            x: bubbleCenterX - currentW / 2,
            y: bubbleCenterY - currentH / 2,
        });

        scaleAnim.setValue(0.5);
        opacityAnim.setValue(0.2);

        setShowNote(true);

        // স্মুথ অ্যানিমেশন যোগ
        Animated.parallel([
            Animated.spring(scaleAnim, {
                toValue: 1,
                friction: 8,
                tension: 40,
                useNativeDriver: false,
                restSpeedThreshold: 0.1,
                restDisplacementThreshold: 0.1
            }),
            Animated.spring(opacityAnim, {
                toValue: settings.opacity,
                friction: 8,
                tension: 40,
                useNativeDriver: false,
                restSpeedThreshold: 0.1,
                restDisplacementThreshold: 0.1
            }),
            Animated.spring(notePan, {
                toValue: { x: currentX, y: currentY },
                friction: 8,
                tension: 40,
                useNativeDriver: false,
                restSpeedThreshold: 0.1,
                restDisplacementThreshold: 0.1
            }),
        ]).start();

        if (activeNoteId !== null) {
            setIsViewingMode(true);
        }
    };

    const handleClose = (isMinimize = false, isBackToNotesList = false) => {

        if (activeNoteId !== null && !isViewingMode) {
            savePositions();
            setIsViewingMode(true);
        }

        if (activeNoteId !== null && isBackToNotesList) {
            savePositions();
            setActiveNoteId(null);
            return;
        }

        if (isAnimatingClose.current) return;
        isAnimatingClose.current = true;

        const currentW = noteWidth.__getValue();
        const currentH = noteHeight.__getValue();
        const currentX = notePan.x.__getValue();
        const currentY = notePan.y.__getValue();

        notePositionBeforeMinimizeRef.current = {
            x: currentX,
            y: currentY,
            width: currentW,
            height: currentH
        };

        const noteToSaveId = activeNoteId || notes[0]?.id;
        if (noteToSaveId) {
            savePositions();
            setNotes(prevNotes =>
                prevNotes.map(note =>
                    note.id === noteToSaveId
                        ? {
                            ...note,
                            lastX: currentX,
                            lastY: currentY,
                            lastW: currentW,
                            lastH: currentH,
                        }
                        : note
                )
            );
        }

        const noteCenterX = currentX + currentW / 2;
        const noteCenterY = currentY + currentH / 2;

        const targetBubbleX = noteCenterX - BUBBLE_SIZE / 2;
        const targetBubbleY = noteCenterY - BUBBLE_SIZE / 2;

        Animated.parallel([
            Animated.spring(scaleAnim, {
                toValue: 0.5,
                friction: 8,
                tension: 40,
                useNativeDriver: false,
                restSpeedThreshold: 0.1,
                restDisplacementThreshold: 0.1
            }),
            Animated.spring(opacityAnim, {
                toValue: 0.2,
                friction: 8,
                tension: 40,
                useNativeDriver: false,
                restSpeedThreshold: 0.1,
                restDisplacementThreshold: 0.1
            }),
            Animated.spring(notePan, {
                toValue: {
                    x: noteCenterX - currentW / 2,
                    y: noteCenterY - currentH / 2
                },
                friction: 8,
                tension: 40,
                useNativeDriver: false,
                restSpeedThreshold: 0.1,
                restDisplacementThreshold: 0.1
            }),
        ]).start(() => {
            Animated.spring(bubblePan, {
                toValue: { x: bubblePositionRef.current.x, y: bubblePositionRef.current.y },
                friction: 8,
                tension: 40,
                useNativeDriver: false,
                restSpeedThreshold: 0.1,
                restDisplacementThreshold: 0.1
            }).start();

            scaleAnim.setValue(1);
            opacityAnim.setValue(1);
            setShowNote(false);
            isAnimatingClose.current = false;
        });
    };

    const handleMinimizeToBubble = () => {
        if (isMinimizing) return;

        setIsMinimizing(true);

        // অ্যানিমেশন শুরু
        Animated.parallel([
            Animated.timing(scaleAnim, {
                toValue: 0.5,
                duration: TRANSITION_DURATION.MINIMIZE,
                useNativeDriver: false,
            }),
            Animated.timing(opacityAnim, {
                toValue: 0.2,
                duration: TRANSITION_DURATION.MINIMIZE,
                useNativeDriver: false,
            }),
        ]).start(() => {
            bubblePositionRef.current = {
                x: bubblePan.x.__getValue(),
                y: bubblePan.y.__getValue()
            };
            handleClose(true);
            setTimeout(() => setIsMinimizing(false), 100);
        });
    };

const handleDestroy = () => {
    if (isAnimatingClose.current) return;

    if (activeNoteId !== null && activeNote) {
        if (!isViewingMode) {
            savePositions();
            if (activeNote.content !== history.current) {
                updateActiveNoteState(history.current, false);
            }
            setIsViewingMode(true);
        }
    }

    // ✅ বাবল বন্ধ করার জন্য - stopFloatingBubble কল করুন
    if (typeof stopFloatingBubble === 'function') {
        stopFloatingBubble();
    }

    setShowNote(false);
    setActiveNoteId(null);
    isAnimatingClose.current = false;

    setIsNoteTemporarilyUnlockedId(null);
    currentScrollYRef.current = 0;
};

    // --- Note Pan Responder ---
    const noteResponder = useRef(
        PanResponder.create({
            onStartShouldSetPanResponder: () => true,
            onMoveShouldSetPanResponder: () => true,
            onPanResponderGrant: () => {
                notePan.stopAnimation();
                notePan.setOffset(notePan.__getValue());
                notePan.setValue({ x: 0, y: 0 });
            },
            onPanResponderMove: Animated.event([null, { dx: notePan.x, dy: notePan.y }], { useNativeDriver: false, }),
            onPanResponderRelease: (_, g) => {
                notePan.flattenOffset();
                const currentW = noteWidth.__getValue();
                const currentH = noteHeight.__getValue();

                const finalX = clamp(notePan.x._value, EDGE_SNAP, width - currentW - EDGE_SNAP);
                const finalY = clamp(notePan.y._value, 40, height - currentH - EDGE_SNAP);

                Animated.spring(notePan, {
                    toValue: { x: finalX, y: finalY },
                    friction: 6,
                    useNativeDriver: false,
                }).start(() => {
                    const noteToSaveId = activeNoteId || notes[0]?.id;
                    if (noteToSaveId) {
                        setNotes(prevNotes =>
                            prevNotes.map(note =>
                                note.id === noteToSaveId
                                    ? { ...note, lastX: finalX, lastY: finalY }
                                    : note
                            )
                        );
                    }
                });
            },
        })
    ).current;
    // সেটিংস ওপেন ফাংশন (আইকন ট্যাপে)
    const handleSettingsOpen = () => {
        setIsSettingsOpening(true);
        setIsSettingsVisible(true);

        // অ্যানিমেশন ডিলে
        setTimeout(() => {
            setIsSettingsOpening(false);
        }, TRANSITION_DURATION.SETTINGS);
    };

    const handleSetPasswordOpen = () => {
        setIsChangePasswordModalVisible(true);
        setIsModalAnimating(true);

        setTimeout(() => {
            setIsModalAnimating(false);
        }, TRANSITION_DURATION.MODAL);
    };

    const handleSetPasswordClose = () => {
        setIsModalAnimating(true);

        setTimeout(() => {
            setIsChangePasswordModalVisible(false);
            setNewMasterPasswordInput('');
            setIsModalAnimating(false);
        }, TRANSITION_DURATION.MODAL);
    };

    const handlePasswordChangeClose = () => {
        setIsModalAnimating(true);

        setTimeout(() => {
            setIsChangePasswordModalVisible(false);
            setOldMasterPasswordInput('');
            setNewMasterPasswordInput('');
            setIsModalAnimating(false);
        }, TRANSITION_DURATION.MODAL);
    };
    const handleSecurityQuestionOpen = () => {
        setIsSecurityQuestionSetupModalVisible(true);
        setIsModalAnimating(true);

        setTimeout(() => {
            setIsModalAnimating(false);
        }, TRANSITION_DURATION.MODAL);
    };

    const handleSecurityQuestionClose = () => {
        setIsModalAnimating(true);

        setTimeout(() => {
            setIsSecurityQuestionSetupModalVisible(false);
            setIsModalAnimating(false);
        }, TRANSITION_DURATION.MODAL);
    };

    // সেটিংস ক্লোজ ফাংশন
    const handleSettingsClose = () => {
        setIsSettingsClosing(true);

        // অ্যানিমেশন কমপ্লিট হলে মডাল হাইড
        setTimeout(() => {
            setIsSettingsVisible(false);
            setIsSettingsClosing(false);
        }, TRANSITION_DURATION.SETTINGS);
    };

    const resizeResponder = useRef(
        PanResponder.create({
            onStartShouldSetPanResponder: () => true,
            onPanResponderGrant: () => {
                noteWidth.stopAnimation(); noteHeight.stopAnimation();
                startSizeRef.current = { width: noteWidth.__getValue(), height: noteHeight.__getValue(), };
            },
            onPanResponderMove: (_, g) => {
                const newW = clamp(startSizeRef.current.width + g.dx, NOTE_MIN_WIDTH, width - EDGE_SNAP * 2);
                const newH = clamp(startSizeRef.current.height + g.dy, NOTE_MIN_HEIGHT, height - 80);
                noteWidth.setValue(newW); noteHeight.setValue(newH);
            },
            onPanResponderRelease: () => {
                const currentW = noteWidth.__getValue();
                const currentH = noteHeight.__getValue();
                const currentX = notePan.x.__getValue();
                const currentY = notePan.y.__getValue();

                const noteToSaveId = activeNoteId || notes[0]?.id;
                if (noteToSaveId) {
                    setNotes(prevNotes =>
                        prevNotes.map(note =>
                            note.id === noteToSaveId
                                ? { ...note, lastW: currentW, lastH: currentH, lastX: currentX, lastY: currentY }
                                : note
                        )
                    );
                }
            },
        })
    ).current;

    // --- Life Cycle Hooks ---
    useEffect(() => {
        if (activeNoteId !== null && activeNote) {

            noteWidth.setValue(activeNote.lastW || DEFAULT_NOTE_WIDTH);
            noteHeight.setValue(activeNote.lastH || DEFAULT_NOTE_HEIGHT);

            notePan.setOffset({
                x: activeNote.lastX || width - 100,
                y: activeNote.lastY || 400
            });
            notePan.setValue({ x: 0, y: 0 });
            notePan.flattenOffset();

            setHistory({ past: [], current: activeNote.content, future: [] });

            const initialCursorPos = activeNote.lastCursorPos || 0;
            const initialScrollY = activeNote.lastScrollY || 0;

            lastCursorPosRef.current = initialCursorPos;
            currentScrollYRef.current = initialScrollY;

            handleCursorPosition(initialCursorPos);

        } else if (activeNoteId === null) {
            setHistory({ past: [], current: '', future: [] });
            setIsViewingMode(true);
            currentScrollYRef.current = 0;
        }
    }, [activeNoteId]);

    // *** উন্নত এডিট মোডে প্রবেশের লজিক ***
    const handleEnterEditMode = useCallback(() => {
        if (isFocusingRef.current || !activeNote) return;
        isFocusingRef.current = true;

        handleCursorPosition(lastCursorPosRef.current);

        setIsViewingMode(false);

        const lastScrollY = currentScrollYRef.current;

        setTimeout(() => {
            if (textInputRef.current && textInputRef.current.focus) {
                textInputRef.current.focus();

                try {
                    textInputRef.current.setNativeProps &&
                        textInputRef.current.setNativeProps({
                            selection: { start: lastCursorPosRef.current, end: lastCursorPosRef.current }
                        });
                } catch (e) {
                    console.error('Set selection error:', e);
                }
            }

            if (editScrollViewRef.current && editScrollViewRef.current.scrollTo) {
                try {
                    editScrollViewRef.current.scrollTo({ y: lastScrollY, animated: false });
                } catch (e) {
                    console.error('Scroll error:', e);
                }
            }

            isFocusingRef.current = false;
        }, Platform.select({ ios: 50, android: 100 }));
    }, [activeNote, handleCursorPosition]);

    // View Mode পরিবর্তনের সময় স্ক্রল পজিশন সেট করা
    useEffect(() => {
        if (activeNoteId !== null && isViewingMode) {
            if (textInputRef.current && textInputRef.current.blur) {
                textInputRef.current.blur();
            }

            const lastScrollY = currentScrollYRef.current;
            if (scrollViewRef.current && scrollViewRef.current.scrollTo) {
                setTimeout(() => {
                    try {
                        scrollViewRef.current.scrollTo({ y: lastScrollY, animated: false });
                    } catch (e) {
                        console.error('Scroll view error:', e);
                    }
                }, 50);
            }
        }
    }, [isViewingMode, activeNoteId]);

    // *** উন্নত কীবোর্ড ম্যানেজমেন্ট ***
    useEffect(() => {
        const keyboardDidShowListener = Keyboard.addListener('keyboardDidShow', () => {
            setIsKeyboardVisible(true);

            if (!isViewingMode && textInputRef.current && editScrollViewRef.current) {
                setTimeout(() => {
                    try {
                        textInputRef.current.measure((x, y, width, height, pageX, pageY) => {
                            const cursorPosition = pageY - 100;
                            editScrollViewRef.current.scrollTo({
                                y: Math.max(0, cursorPosition),
                                animated: true
                            });
                        });
                    } catch (e) {
                        console.error('Keyboard scroll error:', e);
                    }
                }, 100);
            }
        });

        const keyboardDidHideListener = Keyboard.addListener('keyboardDidHide', () => {
            setIsKeyboardVisible(false);

            if (activeNoteId !== null && !isViewingMode) {
                savePositions();
                setIsViewingMode(true);
            }
        });

        return () => {
            keyboardDidShowListener.remove();
            keyboardDidHideListener.remove();
        };
    }, [activeNoteId, isViewingMode, savePositions]);

    // Cleanup intervals on unmount
    useEffect(() => {
        return () => {
            if (textSelectionIntervalRef.current) {
                clearInterval(textSelectionIntervalRef.current);
            }
            if (fastScrollTimeoutRef.current) {
                clearTimeout(fastScrollTimeoutRef.current);
            }
            if (scrollSyncTimeoutRef.current) {
                clearTimeout(scrollSyncTimeoutRef.current);
            }
            if (scrollMomentumTimeoutRef.current) {
                clearTimeout(scrollMomentumTimeoutRef.current);
            }
        };
    }, []);
    
    useEffect(() => {
    loadAllData();

    // অ্যাপ স্টেট চেঞ্জ হ্যান্ডলার
    const subscription = AppState.addEventListener('change', nextAppState => {
        if (nextAppState === 'active') {
            // অ্যাপ ফোরগ্রাউন্ডে এলে ডেটা রিফ্রেশ করতে পারেন
            if (isAppLoaded) {
                console.log('App came to foreground');
            }
        }
    });

    return () => {
        subscription.remove();
        if (scrollMomentumTimeoutRef.current) {
            clearTimeout(scrollMomentumTimeoutRef.current);
        }
    };
}, []);

// ✅ অ্যাপ লোড হলে অটোমেটিক বাবল স্টার্ট করুন (যদি permission থাকে)  🔴 এই লাইন থেকে শুরু
useEffect(() => {
    if (isAppLoaded && hasOverlayPermission) {
        startFloatingBubble();
    }
}, [isAppLoaded, hasOverlayPermission]);

    // *** View Mode এ ট্যাপ করে Edit Mode এ যাওয়া ***
    const handlePressInViewMode = () => {
        const isNoteDisabled = activeNote?.isLocked === true && activeNoteId !== isNoteTemporarilyUnlockedId;

        if (activeNote && !isNoteDisabled && isViewingMode) {
            handleEnterEditMode();
        }
    };

    // *** উন্নত স্ক্রল পজিশন ট্র্যাকিং ***
    const handleScroll = (event) => {
        const { contentSize, contentOffset, layoutMeasurement } = event.nativeEvent;
        scrollViewContentHeightRef.current = contentSize.height;
        scrollViewVisibleHeightRef.current = layoutMeasurement.height;
        handleScrollSync(event);
    };

    // --- উন্নত Fast Scroll Indicator Render - ভিউ এবং এডিট মোড উভয়ের জন্য ---
    const renderFastScrollIndicator = () => {
        if (!showFastScroll || !scrollViewContentHeightRef.current) return null;

        return (
            <Animated.View
                {...fastScrollResponder.panHandlers}
                style={[
                    styles.fastScrollIndicator,
                    {
                        opacity: scrollIndicatorOpacity,
                        transform: [{ translateY: fastScrollIndicatorY }],
                    }
                ]}
            >
                <View style={styles.scrollIndicatorContent}>
                    <Icon name="chevron-up" size={12} color="#666" />
                    <View style={styles.scrollIndicatorLine} />
                    <Icon name="chevron-down" size={12} color="#666" />
                </View>
            </Animated.View>
        );
    };

    // --- ডিলিট কনফার্মেশন রেন্ডার ---
    const renderDeleteConfirmation = () => {
        if (!showDeleteConfirm) return null;

        return (
            <Animated.View
                style={[
                    styles.deleteConfirmOverlay,
                    {
                        opacity: deleteConfirmAnim,
                    }
                ]}
            >
                <View style={styles.deleteConfirmCircle}>
                    <Icon name="close-circle" size={60} color="#C0392B" />
                </View>
            </Animated.View>
        );
    };

    // --- Renders ---
    const renderBubble = () => (
        <Animated.View
            {...bubbleResponder.panHandlers}
            style={[
                styles.bubble,
                {
                    transform: bubblePan.getTranslateTransform(),
                    backgroundColor: settings.topBarColor,
                },
            ]}
        >
            <Icon name="documents-outline" size={BUBBLE_SIZE * 0.5} color={settings.iconColor} />
        </Animated.View>
    );

    // --- সিকিউরিটি প্রশ্ন সেটআপ মোডাল ---
    const renderSecurityQuestionSetupModal = () => (
        <Modal
            animationType={isModalAnimating ? "slide" : "fade"}
            transparent={true}
            visible={isSecurityQuestionSetupModalVisible}
            onRequestClose={handleSecurityQuestionClose}
        >
            <View style={styles.centeredView}>
                <ScrollView style={styles.fullWidthModal}>
                    <View style={styles.modalView}>
                        <Text style={styles.modalTitle}>
                            {isSecuritySetupComplete ? "Set New Security Question" : "Setup Security Question"}
                        </Text>

                        <Text style={styles.securityDescription}>
                            {isSecuritySetupComplete
                                ? "Set a new security question for password recovery."
                                : "Set up a security question to recover your password if you forget it."
                            }
                        </Text>

                        <View style={styles.securityQuestionContainer}>
                            <Text style={styles.securityQuestionLabel}>
                                Security Question:
                            </Text>

                            <View style={styles.questionPickerContainer}>
                                <Text style={styles.selectedQuestionText}>
                                    {securityQuestion.question}
                                </Text>
                                <TouchableOpacity
                                    style={styles.changeQuestionButton}
                                    onPress={() => {
                                        Alert.alert(
                                            "Select Security Question",
                                            "Choose a security question:",
                                            SECURITY_QUESTIONS_LIST.map((question, qIndex) => ({
                                                text: question,
                                                onPress: () => {
                                                    setSecurityQuestion(prev => ({
                                                        ...prev,
                                                        question: question,
                                                        answer: '',
                                                        encryptedAnswer: ''
                                                    }));
                                                }
                                            })).concat([
                                                { text: "Cancel", style: "cancel" }
                                            ])
                                        );
                                    }}
                                >
                                    <Text style={styles.changeQuestionText}>Change</Text>
                                </TouchableOpacity>
                            </View>

                            <Text style={styles.securityQuestionLabel}>
                                Your Answer:
                            </Text>

                            <View style={styles.passwordInputContainer}>
                                <TextInput
                                    style={styles.securityAnswerInput}
                                    value={securityQuestion.answer}
                                    onChangeText={(text) => {
                                        setSecurityQuestion(prev => ({
                                            ...prev,
                                            answer: text
                                        }));
                                    }}
                                    placeholder="Your answer"
                                    secureTextEntry={!showSecurityAnswer}
                                />
                                <TouchableOpacity
                                    style={styles.passwordToggle}
                                    onPress={() => setShowSecurityAnswer(!showSecurityAnswer)}
                                >
                                    <Icon
                                        name={showSecurityAnswer ? "eye-off" : "eye"}
                                        size={20}
                                        color="#888"
                                    />
                                </TouchableOpacity>
                            </View>
                        </View>

                        <View style={styles.buttonRow}>
                            <TouchableOpacity
                                style={[styles.modalButton, styles.cancelButton]}
                                onPress={() => setIsSecurityQuestionSetupModalVisible(false)}
                            >
                                <Text style={styles.closeButtonText}>Cancel</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={[styles.modalButton, styles.saveButton]}
                                onPress={handleSetupSecurityQuestion}
                            >
                                <Text style={styles.closeButtonText}>
                                    {isSecuritySetupComplete ? "Save New Question" : "Save Question"}
                                </Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </ScrollView>
            </View>
        </Modal>
    );

    // --- সিকিউরিটি প্রশ্ন আপডেট মোডাল ---
    const renderSecurityQuestionModal = () => {
        const isUpdateMode = isSecurityQuestionModalVisibleForUpdate;

        const [newSecurityQuestion, setNewSecurityQuestion] = useState(securityQuestion.question);
        const [newSecurityAnswer, setNewSecurityAnswer] = useState('');
        const [showNewSecurityAnswer, setShowNewSecurityAnswer] = useState(false);
        const [isOldAnswerVerified, setIsOldAnswerVerified] = useState(false);

        const handleVerifyOldAnswer = async () => {
            if (securityAnswerInput.trim() === '') {
                Alert.alert("Error", "Please enter your current security answer.");
                return;
            }

            try {
                const encryptedUserAnswer = await encryptData(securityAnswerInput, encryptionKey);
                const isCorrect = encryptedUserAnswer === securityQuestion.encryptedAnswer;

                if (isCorrect) {
                    setIsOldAnswerVerified(true);
                    Alert.alert("Verified", "Old security answer verified successfully!");
                } else {
                    Alert.alert("Error", "Security answer is incorrect.");
                    setSecurityAnswerInput('');
                }
            } catch (error) {
                Alert.alert("Error", "Failed to verify security answer.");
            }
        };

        const handleSetNewSecurityQuestion = async () => {
            if (!isOldAnswerVerified) {
                Alert.alert("Error", "Please verify your old security answer first.");
                return;
            }

            if (newSecurityAnswer.trim() === '') {
                Alert.alert("Error", "Please enter answer for new security question.");
                return;
            }

            try {
                const encryptedNewAnswer = await encryptData(newSecurityAnswer, encryptionKey);
                const updatedQuestion = {
                    question: newSecurityQuestion,
                    answer: newSecurityAnswer,
                    encryptedAnswer: encryptedNewAnswer || ''
                };

                setSecurityQuestion(updatedQuestion);
                setIsSecuritySetupComplete(true);
                setIsSecurityQuestionModalVisible(false);
                setIsSecurityQuestionModalVisibleForUpdate(false);

                setSecurityAnswerInput('');
                setNewSecurityAnswer('');
                setIsOldAnswerVerified(false);

                Alert.alert(
                    "Success",
                    "Security question has been updated successfully!",
                    [{ text: "OK" }]
                );
            } catch (error) {
                Alert.alert("Error", "Failed to update security question.");
            }
        };

        const handleCloseModal = () => {
            setIsSecurityQuestionModalVisible(false);
            setIsSecurityQuestionModalVisibleForUpdate(false);
            setSecurityAnswerInput('');
            setNewSecurityAnswer('');
            setIsOldAnswerVerified(false);
        };

        return (
            <Modal
                animationType="slide"
                transparent={true}
                visible={isSecurityQuestionModalVisible}
                onRequestClose={handleCloseModal}
            >
                <View style={styles.centeredView}>
                    <ScrollView style={styles.fullWidthModal}>
                        <View style={styles.modalView}>
                            <Text style={styles.modalTitle}>
                                {isUpdateMode ? "Update Security Question" : "Security Verification"}
                            </Text>

                            <Text style={styles.securityDescription}>
                                {isUpdateMode
                                    ? "First verify your old security answer, then set a new security question."
                                    : "Please answer your security question to reset your password:"}
                            </Text>

                            <View style={styles.securityQuestionContainer}>
                                <Text style={styles.securityQuestionLabel}>
                                    Current Security Question:
                                </Text>
                                <Text style={styles.selectedQuestionText}>
                                    {securityQuestion.question}
                                </Text>

                                <Text style={styles.securityQuestionLabel}>
                                    Verify Your Current Answer:
                                </Text>

                                <View style={styles.passwordInputContainer}>
                                    <TextInput
                                        style={styles.securityAnswerInput}
                                        value={securityAnswerInput}
                                        onChangeText={setSecurityAnswerInput}
                                        placeholder="Enter current security answer"
                                        secureTextEntry={!showSecurityAnswer}
                                        editable={!isOldAnswerVerified}
                                    />
                                    <TouchableOpacity
                                        style={styles.passwordToggle}
                                        onPress={() => setShowSecurityAnswer(!showSecurityAnswer)}
                                    >
                                        <Icon
                                            name={showSecurityAnswer ? "eye-off" : "eye"}
                                            size={20}
                                            color="#888"
                                        />
                                    </TouchableOpacity>
                                </View>

                                {!isOldAnswerVerified ? (
                                    <TouchableOpacity
                                        style={[styles.modalButton, styles.saveButton, { marginTop: 10 }]}
                                        onPress={handleVerifyOldAnswer}
                                    >
                                        <Text style={styles.closeButtonText}>Verify Answer</Text>
                                    </TouchableOpacity>
                                ) : (
                                    <View style={styles.verifiedBadge}>
                                        <Icon name="checkmark-circle" size={20} color="#27AE60" />
                                        <Text style={styles.verifiedText}>Verified Successfully</Text>
                                    </View>
                                )}
                            </View>

                            {isOldAnswerVerified && (
                                <View style={[styles.securityQuestionContainer, { marginTop: 20 }]}>
                                    <Text style={styles.securityQuestionLabel}>
                                        Set New Security Question:
                                    </Text>

                                    <View style={styles.questionPickerContainer}>
                                        <Text style={styles.selectedQuestionText}>
                                            {newSecurityQuestion}
                                        </Text>
                                        <TouchableOpacity
                                            style={styles.changeQuestionButton}
                                            onPress={() => {
                                                Alert.alert(
                                                    "Select New Security Question",
                                                    "Choose a security question:",
                                                    SECURITY_QUESTIONS_LIST.map((question, qIndex) => ({
                                                        text: question,
                                                        onPress: () => {
                                                            setNewSecurityQuestion(question);
                                                        }
                                                    })).concat([
                                                        { text: "Cancel", style: "cancel" }
                                                    ])
                                                );
                                            }}
                                        >
                                            <Text style={styles.changeQuestionText}>Change</Text>
                                        </TouchableOpacity>
                                    </View>

                                    <Text style={styles.securityQuestionLabel}>
                                        New Answer:
                                    </Text>

                                    <View style={styles.passwordInputContainer}>
                                        <TextInput
                                            style={styles.securityAnswerInput}
                                            value={newSecurityAnswer}
                                            onChangeText={setNewSecurityAnswer}
                                            placeholder="Enter new security answer"
                                            secureTextEntry={!showNewSecurityAnswer}
                                        />
                                        <TouchableOpacity
                                            style={styles.passwordToggle}
                                            onPress={() => setShowNewSecurityAnswer(!showNewSecurityAnswer)}
                                        >
                                            <Icon
                                                name={showNewSecurityAnswer ? "eye-off" : "eye"}
                                                size={20}
                                                color="#888"
                                            />
                                        </TouchableOpacity>
                                    </View>
                                </View>
                            )}

                            <View style={styles.buttonRow}>
                                <TouchableOpacity
                                    style={[styles.modalButton, styles.cancelButton]}
                                    onPress={handleCloseModal}
                                >
                                    <Text style={styles.closeButtonText}>Cancel</Text>
                                </TouchableOpacity>

                                {isUpdateMode ? (
                                    <TouchableOpacity
                                        style={[styles.modalButton, styles.saveButton]}
                                        onPress={handleSetNewSecurityQuestion}
                                        disabled={!isOldAnswerVerified}
                                    >
                                        <Text style={styles.closeButtonText}>
                                            Set New Question
                                        </Text>
                                    </TouchableOpacity>
                                ) : (
                                    <TouchableOpacity
                                        style={[styles.modalButton, styles.saveButton]}
                                        onPress={handleVerifySecurityAnswerForForget}
                                    >
                                        <Text style={styles.closeButtonText}>
                                            Verify & Reset Password
                                        </Text>
                                    </TouchableOpacity>
                                )}
                            </View>
                        </View>
                    </ScrollView>
                </View>
            </Modal>
        );
    };

    // --- রিকোভারি পাসওয়ার্ড মোডাল ---
    const renderRecoveryPasswordModal = () => (
        <Modal
            animationType="slide"
            transparent={true}
            visible={isRecoveryPasswordModalVisible}
            onRequestClose={() => {
                setIsRecoveryPasswordModalVisible(false);
                setRecoveryPasswordInput('');
            }}
        >
            <View style={styles.centeredView}>
                <View style={styles.modalView}>
                    <Text style={styles.modalTitle}>Set New Password</Text>

                    <Text style={styles.securityDescription}>
                        Security verified! Please set a new master password.
                    </Text>

                    <View style={styles.passwordInputContainer}>
                        <TextInput
                            style={styles.securityAnswerInput}
                            value={recoveryPasswordInput}
                            onChangeText={setRecoveryPasswordInput}
                            placeholder="New master password (min 3 characters)"
                            secureTextEntry={!showRecoveryPassword}
                        />
                        <TouchableOpacity
                            style={styles.passwordToggle}
                            onPress={() => setShowRecoveryPassword(!showRecoveryPassword)}
                        >
                            <Icon
                                name={showRecoveryPassword ? "eye-off" : "eye"}
                                size={20}
                                color="#888"
                            />
                        </TouchableOpacity>
                    </View>

                    <View style={styles.buttonRow}>
                        <TouchableOpacity
                            style={[styles.modalButton, styles.cancelButton]}
                            onPress={() => {
                                setIsRecoveryPasswordModalVisible(false);
                                setRecoveryPasswordInput('');
                            }}
                        >
                            <Text style={styles.closeButtonText}>Cancel</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={[styles.modalButton, styles.saveButton]}
                            onPress={handleRecoveryPasswordSubmit}
                        >
                            <Text style={styles.closeButtonText}>Set New Password</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        </Modal>
    );

    const renderSetPasswordModal = () => (
        <Modal
            animationType={isModalAnimating ? "slide" : "fade"}
            transparent={true}
            visible={isChangePasswordModalVisible && !isPasswordSet}
            onRequestClose={handleSetPasswordClose}
        >
            <View style={styles.centeredView}>
                <View style={styles.modalView}>
                    <Text style={styles.modalTitle}>Set Master Password</Text>

                    <Text style={styles.settingLabel}>New Password:</Text>
                    <View style={styles.passwordInputContainer}>
                        <TextInput
                            style={styles.passwordInput}
                            value={newMasterPasswordInput}
                            onChangeText={setNewMasterPasswordInput}
                            secureTextEntry={!showNewMasterPassword}
                            placeholder="Enter New Password (min 3 chars)"
                            keyboardType="default"
                        />
                        <TouchableOpacity style={styles.passwordToggle} onPress={() => setShowNewMasterPassword(!showNewMasterPassword)}>
                            <Icon name={showNewMasterPassword ? "eye-off" : "eye"} size={20} color="#888" />
                        </TouchableOpacity>
                    </View>

                    <View style={styles.buttonRow}>
                        <TouchableOpacity
                            style={[styles.modalButton, styles.cancelButton]}
                            onPress={() => {
                                setIsChangePasswordModalVisible(false);
                                setNewMasterPasswordInput('');
                            }}
                        >
                            <Text style={styles.closeButtonText}>Cancel</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[styles.modalButton, styles.saveButton]}
                            onPress={handleSetPasswordSubmit}
                        >
                            <Text style={styles.closeButtonText}>Set Password</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        </Modal>
    );

    const renderChangePasswordModal = () => (
        <Modal
            animationType={isModalAnimating ? "slide" : "fade"}
            transparent={true}
            visible={isChangePasswordModalVisible && isPasswordSet}
            onRequestClose={handlePasswordChangeClose}
        >
            <View style={styles.centeredView}>
                <View style={styles.modalView}>
                    <Text style={styles.modalTitle}>Change Master Password</Text>

                    <Text style={styles.settingLabel}>Old Password:</Text>
                    <View style={styles.passwordInputContainer}>
                        <TextInput
                            style={styles.passwordInput}
                            value={oldMasterPasswordInput}
                            onChangeText={setOldMasterPasswordInput}
                            secureTextEntry={!showOldMasterPassword}
                            placeholder="Enter Old Password"
                            keyboardType="default"
                        />
                        <TouchableOpacity style={styles.passwordToggle} onPress={() => setShowOldMasterPassword(!showOldMasterPassword)}>
                            <Icon name={showOldMasterPassword ? "eye-off" : "eye"} size={20} color="#888" />
                        </TouchableOpacity>
                    </View>

                    <Text style={styles.settingLabel}>New Password:</Text>
                    <View style={styles.passwordInputContainer}>
                        <TextInput
                            style={styles.passwordInput}
                            value={newMasterPasswordInput}
                            onChangeText={setNewMasterPasswordInput}
                            secureTextEntry={!showNewMasterPassword}
                            placeholder="Enter New Password (min 3 chars)"
                            keyboardType="default"
                        />
                        <TouchableOpacity style={styles.passwordToggle} onPress={() => setShowNewMasterPassword(!showNewMasterPassword)}>
                            <Icon name={showNewMasterPassword ? "eye-off" : "eye"} size={20} color="#888" />
                        </TouchableOpacity>
                    </View>

                    <View style={styles.buttonRow}>
                        <TouchableOpacity
                            style={[styles.modalButton, styles.cancelButton]}
                            onPress={() => {
                                setIsChangePasswordModalVisible(false);
                                setOldMasterPasswordInput('');
                                setNewMasterPasswordInput('');
                            }}
                        >
                            <Text style={styles.closeButtonText}>Cancel</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[styles.modalButton, styles.saveButton]}
                            onPress={handlePasswordChangeSubmit}
                        >
                            <Text style={styles.closeButtonText}>Change Password</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        </Modal>
    );

    const renderSettingsModal = () => (
        <Modal
            animationType={isSettingsOpening ? "slide" : isSettingsClosing ? "slide" : "fade"}
            transparent={true}
            visible={isSettingsVisible}
            onRequestClose={handleSettingsClose}
        >
            <View style={styles.centeredView}>
                <ScrollView style={styles.fullWidthModal}>
                    <View style={styles.modalView}>
                        <Text style={styles.modalTitle}>App Settings</Text>

                        <Text style={styles.settingLabel}>Text Size ({settings.childTextSize}px):</Text>
                        <Slider
                            style={styles.slider}
                            minimumValue={10}
                            maximumValue={20}
                            step={1}
                            value={settings.childTextSize}
                            onValueChange={(value) => setSettings(prev => ({ ...prev, childTextSize: value }))}
                            minimumTrackTintColor="#27AE60"
                            maximumTrackTintColor="#ccc"
                        />

                        <Text style={styles.settingLabel}>Opacity ({settings.opacity * 100}%):</Text>
                        <Slider
                            style={styles.slider}
                            minimumValue={0.4}
                            maximumValue={1}
                            step={0.05}
                            value={settings.opacity}
                            onValueChange={(value) => setSettings(prev => ({ ...prev, opacity: value }))}
                            minimumTrackTintColor="#3498DB"
                            maximumTrackTintColor="#ccc"
                        />

                        <Text style={styles.settingLabel}>App Background Color:</Text>
                        <View style={styles.colorOptionsContainer}>
                            {['#fff8dc', '#f0fff0', '#f5f5f5'].map((color, index) => (
                                <TouchableOpacity
                                    key={color}
                                    style={[
                                        styles.colorButton,
                                        { backgroundColor: color },
                                        settings.mainBgColor === color && { borderWidth: 3, borderColor: '#27AE60' }
                                    ]}
                                    onPress={() => {
                                        setSettings(prev => ({
                                            ...prev,
                                            mainBgColor: color,
                                            topBarColor: color === '#fff8dc' ? '#f9e79f' :
                                                color === '#f0fff0' ? '#d4edda' : '#e9ecef',
                                            bottomBarColor: color === '#fff8dc' ? '#f9e79f' :
                                                color === '#f0fff0' ? '#d4edda' : '#e9ecef',
                                            childBgColor: color
                                        }));
                                    }}
                                >
                                    <Text style={styles.colorButtonText}>
                                        {color === '#fff8dc' ? 'Default' :
                                            color === '#f0fff0' ? 'Pale Green' : 'Light Gray'}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </View>

                        {/* স্ক্রলিং গতি কন্ট্রোল */}
                        <View style={styles.settingRow}>
                            <Text style={styles.settingLabel}>স্ক্রলিং গতি ({scrollSpeed.toFixed(1)}x):</Text>
                            <Slider
                                style={styles.slider}
                                minimumValue={0.5}
                                maximumValue={3.0}
                                step={0.1}
                                value={scrollSpeed}
                                onValueChange={(value) => setScrollSpeed(value)}
                                minimumTrackTintColor="#3498DB"
                                maximumTrackTintColor="#ccc"
                            />
                            <Text style={styles.toggleDescription}>
                                {scrollSpeed < 1.0 ? "ধীর গতি" :
                                    scrollSpeed < 2.0 ? "সাধারণ গতি" : "দ্রুত গতি"}
                            </Text>
                        </View>

                        {/* Quick Launch Notification Toggle */}
                        <View style={styles.settingRow}>
                            <Text style={styles.settingLabel}>Quick Launch Notification:</Text>
                            <View style={styles.toggleContainer}>
                                <Text style={styles.toggleLabel}>
                                    {enableNotification ? "Enabled" : "Disabled"}
                                </Text>
                                <TouchableOpacity
                                    style={[
                                        styles.toggleButton,
                                        { backgroundColor: enableNotification ? '#27AE60' : '#ccc' }
                                    ]}
                                    onPress={() => {
                                        const newValue = !enableNotification;
                                        setEnableNotification(newValue);
                                        Alert.alert(
                                            "Notification Setting",
                                            newValue
                                                ? "Quick launch notification enabled! Pull down notification panel to instantly open note pad."
                                                : "Quick launch notification disabled."
                                        );
                                    }}
                                >
                                    <View style={[
                                        styles.toggleCircle,
                                        { transform: [{ translateX: enableNotification ? 20 : 0 }] }
                                    ]} />
                                </TouchableOpacity>
                            </View>
                            <Text style={styles.toggleDescription}>
                                {enableNotification
                                    ? "Tap notification panel to instantly open Floating Notes."
                                    : "Enable to get quick access from notification panel."
                                }
                            </Text>
                        </View>

                        {/* Dark Mode Toggle */}
                        <View style={styles.settingRow}>
                            <Text style={styles.settingLabel}>Dark Mode:</Text>
                            <View style={styles.toggleContainer}>
                                <Text style={styles.toggleLabel}>
                                    {darkModeEnabled ? "Enabled" : "Disabled"}
                                </Text>
                                <TouchableOpacity
                                    style={[
                                        styles.toggleButton,
                                        { backgroundColor: darkModeEnabled ? '#27AE60' : '#ccc' }
                                    ]}
                                    onPress={toggleDarkMode}
                                >
                                    <View style={[
                                        styles.toggleCircle,
                                        { transform: [{ translateX: darkModeEnabled ? 20 : 0 }] }
                                    ]} />
                                </TouchableOpacity>
                            </View>
                            <Text style={styles.toggleDescription}>
                                {darkModeEnabled
                                    ? "App is in dark mode with dark theme colors."
                                    : "App is in light mode with default theme colors."
                                }
                            </Text>
                        </View>

                        {/* Security Section */}
                        <View style={styles.securitySection}>
                            <Text style={styles.settingLabel}>Security Settings:</Text>

                            <View style={styles.securityStatusContainer}>
                                <View style={[
                                    styles.securityStatusIndicator,
                                    { backgroundColor: isPasswordSet ? '#27AE60' : '#E74C3C' }
                                ]}>
                                    <Icon
                                        name={isPasswordSet ? "lock-closed" : "lock-open"}
                                        size={16}
                                        color="white"
                                    />
                                </View>
                                <Text style={styles.securityStatusText}>
                                    {isPasswordSet
                                        ? "Password is set"
                                        : "Password is not set"}
                                </Text>
                            </View>

                            <View style={styles.securityStatusContainer}>
                                <View style={[
                                    styles.securityStatusIndicator,
                                    { backgroundColor: isSecuritySetupComplete ? '#27AE60' : '#E74C3C' }
                                ]}>
                                    <Icon
                                        name={isSecuritySetupComplete ? "shield-checkmark" : "shield"}
                                        size={16}
                                        color="white"
                                    />
                                </View>
                                <Text style={styles.securityStatusText}>
                                    {isSecuritySetupComplete
                                        ? "Security question is set up"
                                        : "Security question is not set up"}
                                </Text>
                            </View>

                            <TouchableOpacity
                                style={styles.securityButton}
                                onPress={() => setIsChangePasswordModalVisible(true)}
                            >
                                <Text style={styles.securityButtonText}>
                                    {isPasswordSet ? "Change Password" : "Set Password"}
                                </Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={styles.securityButton}
                                onPress={() => {
                                    if (isSecuritySetupComplete) {
                                        setIsSecurityQuestionModalVisibleForUpdate(true);
                                        setIsSecurityQuestionModalVisible(true);
                                    } else {
                                        setIsSecurityQuestionSetupModalVisible(true);
                                    }
                                }}
                            >
                                <Text style={styles.securityButtonText}>
                                    {isSecuritySetupComplete
                                        ? "Update Security Question"
                                        : "Setup Security Question"}
                                </Text>
                            </TouchableOpacity>

                            {isPasswordSet && (
                                <TouchableOpacity
                                    style={styles.securityButton}
                                    onPress={handleForgetPassword}
                                >
                                    <Text style={styles.securityButtonText}>Forgot Password?</Text>
                                </TouchableOpacity>
                            )}
                        </View>

                        <View style={styles.buttonRow}>
                            <TouchableOpacity
                                style={[styles.modalButton, styles.cancelButton]}
                                onPress={handleSettingsCancel}
                            >
                                <Text style={styles.closeButtonText}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.modalButton, styles.saveButton]}
                                onPress={handleSettingsSave}
                            >
                                <Text style={styles.closeButtonText}>Save Settings</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </ScrollView>
            </View>
        </Modal>
    );

    const renderPasswordModal = () => (
        <Modal
            animationType="fade"
            transparent={true}
            visible={passwordModalVisible}
            onRequestClose={() => {
                setPasswordModalVisible(false);
                setActiveNoteId(null);
            }}
        >
            <View style={styles.centeredView}>
                <View style={styles.modalView}>
                    <Text style={styles.modalTitle}>Enter Master Password</Text>
                    <Text style={{ marginBottom: 15, textAlign: 'center' }}>To unlock and view this note, enter your master password.</Text>

                    <View style={styles.passwordInputContainer}>
                        <TextInput
                            style={styles.passwordInput}
                            value={tempPassword}
                            onChangeText={setTempPassword}
                            secureTextEntry={!showUnlockPassword}
                            placeholder="Master Password"
                            keyboardType="default"
                            onSubmitEditing={handlePasswordSubmit}
                        />
                        <TouchableOpacity style={styles.passwordToggle} onPress={() => setShowUnlockPassword(!showUnlockPassword)}>
                            <Icon name={showUnlockPassword ? "eye-off" : "eye"} size={20} color="#888" />
                        </TouchableOpacity>
                    </View>

                    <View style={styles.buttonRow}>
                        <TouchableOpacity
                            style={[styles.modalButton, styles.cancelButton]}
                            onPress={() => {
                                setPasswordModalVisible(false);
                                setActiveNoteId(null);
                            }}
                        >
                            <Text style={styles.closeButtonText}>Cancel</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[styles.modalButton, styles.saveButton]}
                            onPress={handlePasswordSubmit}
                        >
                            <Text style={styles.closeButtonText}>Unlock</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        </Modal>
    );

    const ItemSeparator = () => <View style={{ height: 8 }} />;

    const renderNoteItem = ({ item, index }) => {
        const isLocked = item.isLocked;
        const currentNoteHeight = noteHeight.__getValue();
        const isSmallHeight = currentNoteHeight < 220;

        return (
            <View style={styles.listItemWrapper}>
                {/* Up/Down Buttons - ছোট উচ্চতায় লুকানো */}
                {!isSmallHeight && (
                    <View style={styles.sortButtonsContainer}>
                        <TouchableOpacity
                            onPress={() => handleMoveNote(item.id, 'up')}
                            style={[styles.sortButton, index === 0 && styles.disabledSortButton]}
                            disabled={index === 0}
                        >
                            <Icon name="arrow-up" size={16} color="#444" />
                        </TouchableOpacity>
                        <TouchableOpacity
                            onPress={() => handleMoveNote(item.id, 'down')}
                            style={[styles.sortButton, index === notes.length - 1 && styles.disabledSortButton]}
                            disabled={index === notes.length - 1}
                        >
                            <Icon name="arrow-down" size={16} color="#444" />
                        </TouchableOpacity>
                    </View>
                )}

                {/* Note Content and Lock */}
                <TouchableOpacity
                    style={[
                        styles.listItem,
                        isSmallHeight && styles.smallHeightListItem
                    ]}
                    onPress={() => handleOpenNote(item.id)}
                >
                    <View style={[styles.smallLockIconContainer, { backgroundColor: isLocked ? '#C0392B' : '#27AE60' }]}>
                        <Icon name={isLocked ? "lock-closed" : "lock-open"} size={10} color="white" />
                    </View>
                    <Text style={styles.listItemTitle} numberOfLines={1}>
                        {item.title}
                    </Text>

                    {/* ছোট উচ্চতায় প্রিভিউ দেখাবে না */}
                    {!isSmallHeight && (
                        <>
                            <Text style={styles.listItemPreview} numberOfLines={1}>
                                {item.preview}
                            </Text>
                            <Text style={[styles.listItemPreview, { fontSize: 9, marginTop: 3 }]}>
                                Last Edited: {new Date(item.lastEdited).toLocaleString()}
                            </Text>
                        </>
                    )}
                </TouchableOpacity>

                {/* Delete Button - ছোট উচ্চতায় লুকানো */}
                {!isSmallHeight && (
                    <TouchableOpacity
                        style={styles.deleteButtonAbsolute}
                        onPress={() => handleDeleteNote(item.id)}
                    >
                        <Icon name="close-circle-outline" size={20} color="#C0392B" />
                    </TouchableOpacity>
                )}
            </View>
        );
    };

    const renderNoteList = () => (
        <View style={{ flex: 1, backgroundColor: settings.mainBgColor, borderRadius: 12 }}>
            <View style={[styles.topBarContainer, { backgroundColor: settings.topBarColor }]}>
                <View {...noteResponder.panHandlers} style={styles.dragArea}>
                    <Text style={styles.noteTitle}>Note List ({notes.length})</Text>
                </View>

                {/* Settings Button */}
                <TouchableWithoutFeedback onPress={() => setIsSettingsVisible(true)}>
                    <View style={styles.iconButton}>
                        <Icon name="settings-outline" size={22} color={settings.iconColor} />
                    </View>
                </TouchableWithoutFeedback>

                {/* Create New Note Button */}
                <TouchableWithoutFeedback onPress={handleCreateNewNote}>
                    <View style={styles.iconButton}>
                        <Icon name="add-circle-outline" size={22} color={settings.iconColor} />
                    </View>
                </TouchableWithoutFeedback>

                {/* Minimize Button */}
                <TouchableWithoutFeedback onPress={handleMinimizeToBubble}>
                    <View style={styles.iconButton}>
                        <Icon name="remove-circle-outline" size={22} color={settings.iconColor} />
                    </View>
                </TouchableWithoutFeedback>

                {/* Close Button */}
                <TouchableWithoutFeedback onPress={handleDestroy}>
                    <View style={styles.iconButton}>
                        <Icon name="close-circle" size={22} color={settings.closeIconColor} />
                    </View>
                </TouchableWithoutFeedback>
            </View>

            <FlatList
                data={notes}
                renderItem={renderNoteItem}
                keyExtractor={item => item.id}
                contentContainerStyle={styles.listContentContainer}
                ItemSeparatorComponent={ItemSeparator}
            />

            <Animated.View {...resizeResponder.panHandlers} style={[styles.resizeHandle, { backgroundColor: settings.bottomBarColor }]}>
                <Icon name="resize-outline" size={10} color={settings.iconColor} />
            </Animated.View>
        </View>
    );

    // Note Editor 
    const renderNoteEditor = () => {
        if (!activeNote) return null;

        const isNoteDisabled = activeNote.isLocked === true && activeNoteId !== isNoteTemporarilyUnlockedId;

        // View Mode (Read Only)
        const renderViewMode = () => (
            <View style={{ flex: 1, position: 'relative' }}>
                <ScrollView
                    ref={scrollViewRef}
                    style={styles.inputContainer}
                    contentContainerStyle={{ padding: 12, flexGrow: 1 }}
                    showsVerticalScrollIndicator={true}
                    decelerationRate="fast"  // দ্রুত স্ক্রলিং
                    removeClippedSubviews={true}
                    scrollEventThrottle={16}
                    onScroll={handleScroll}
                    overScrollMode="always"  // ওভারস্ক্রল এনেবল
                    scrollEnabled={true}
                    pagingEnabled={false}
                    bounces={true}  // iOS বাউন্স
                    alwaysBounceVertical={true}  // iOS উল্লম্ব বাউন্স
                    onScrollBeginDrag={handleScrollBeginDrag}
                    onScrollEndDrag={handleScrollEndDrag}
                    onMomentumScrollEnd={handleMomentumScrollEnd}
                >
                    <TouchableOpacity
                        activeOpacity={1}
                        onPress={!isNoteDisabled ? handlePressInViewMode : undefined}
                        disabled={isNoteDisabled}
                    >
                        <View style={{ flexGrow: 1, minHeight: '100%' }}>
                            <Text
                                style={[
                                    styles.viewText,
                                    {
                                        fontSize: settings.childTextSize,
                                        color: settings.childTextColor,
                                        opacity: isNoteDisabled ? 0.6 : 1,
                                    }
                                ]}
                            >
                                {history.current || (isNoteDisabled ? "This note is locked." : "")}
                            </Text>
                        </View>
                    </TouchableOpacity>
                </ScrollView>
                {renderFastScrollIndicator()}
            </View>
        );

        // Edit Mode (Editable TextInput)
        const renderEditMode = () => (
            <View
                style={{ flex: 1, position: 'relative' }}
                {...textSelectionResponder.panHandlers}
            >
                <ScrollView
                    ref={editScrollViewRef}
                    style={{ flex: 1 }}
                    contentContainerStyle={{ flexGrow: 1 }}
                    keyboardShouldPersistTaps="handled"
                    decelerationRate="fast"  // দ্রুত স্ক্রলিং
                    removeClippedSubviews={true}
                    scrollEventThrottle={16}
                    onScroll={handleScroll}
                    overScrollMode="always"  // ওভারস্ক্রল এনেবল
                    scrollEnabled={true}
                    pagingEnabled={false}
                    bounces={true}  // iOS বাউন্স
                    alwaysBounceVertical={true}  // iOS উল্লম্ব বাউন্স
                    onScrollBeginDrag={handleScrollBeginDrag}
                    onScrollEndDrag={handleScrollEndDrag}
                    onMomentumScrollEnd={handleMomentumScrollEnd}
                >
                    <TextInput
                        ref={textInputRef}
                        key={`edit-${activeNote.id}`}
                        value={history.current}
                        onChangeText={updateActiveNoteContent}
                        style={[
                            styles.input,
                            {
                                fontSize: settings.childTextSize,
                                color: settings.childTextColor,
                                opacity: isNoteDisabled ? 0.6 : 1,
                                minHeight: '100%',
                                backgroundColor: settings.childBgColor
                            }
                        ]}
                        multiline
                        placeholder={isNoteDisabled ? "This note is locked and cannot be edited or shared." : ""}
                        editable={!isNoteDisabled}

                        scrollEnabled={false}
                        textAlignVertical="top"

                        selection={selection}
                        onSelectionChange={handleSelectionChange}

                        onBlur={() => {
                            if (!isNoteDisabled) {
                                if (!isKeyboardVisible) {
                                    handleCursorPosition(lastCursorPosRef.current);
                                }
                            }
                        }}

                        onPressIn={(e) => {
                            const { location } = e.nativeEvent;
                            selectionStartPosRef.current = location;
                            isInTextSelectionMode.current = false;
                        }}

                        onLongPress={(e) => {
                            isInTextSelectionMode.current = true;
                            const { location } = e.nativeEvent;
                            selectionStartPosRef.current = location;
                            lastSelectionYRef.current = e.nativeEvent.pageY;
                        }}

                        contextMenuHidden={false}
                        selectTextOnFocus={false}
                    />
                </ScrollView>
            </View>
        );

        return (
            <View style={{ flex: 1, backgroundColor: settings.childBgColor, borderRadius: 12 }}>
                {/* Top Bar */}
                <View style={[styles.topBarContainer, { backgroundColor: settings.topBarColor }]}>
                    <View {...noteResponder.panHandlers} style={styles.dragArea}>
                        <Text style={styles.noteTitle} numberOfLines={1}>
                            {activeNote.title || 'Untitled Note'}
                            {isSaving && <Text style={styles.savingText}> (Saving...)</Text>}
                            {isViewingMode ? <Text style={styles.savingText}> (View Mode)</Text> : <Text style={styles.savingText}> (Edit Mode)</Text>}
                        </Text>
                    </View>

                    {/* Back, Minimize, Close Buttons */}
                    <TouchableWithoutFeedback onPress={() => handleClose(false, true)}>
                        <View style={styles.iconButton}>
                            <Icon name="arrow-back-circle-outline" size={22} color={settings.iconColor} />
                        </View>
                    </TouchableWithoutFeedback>

                    <TouchableWithoutFeedback onPress={handleMinimizeToBubble}>
                        <View style={styles.iconButton}>
                            <Icon name="remove-circle-outline" size={22} color={settings.iconColor} />
                        </View>
                    </TouchableWithoutFeedback>

                    <TouchableWithoutFeedback onPress={handleDestroy}>
                        <View style={styles.iconButton}>
                            <Icon name="close-circle" size={22} color={settings.closeIconColor} />
                        </View>
                    </TouchableWithoutFeedback>
                </View>

                {/* কন্টেন্ট রেন্ডারিং: View Mode/Edit Mode */}
                <View style={styles.noteContentArea}>
                    {isViewingMode ? renderViewMode() : renderEditMode()}
                </View>

                {/* Bottom Toolbar - সমান দূরত্বে সব আইকন একই ফাংশনে */}
                <View style={[styles.bottomToolbar, { backgroundColor: settings.bottomBarColor }]}>
                    {/* Undo Button */}
                    <TouchableWithoutFeedback
                        onPress={handleUndo}
                        disabled={isNoteDisabled}
                    >
                        <View style={styles.toolbarButton}>
                            <Icon
                                name="arrow-undo-outline"
                                size={16}
                                color={!isNoteDisabled ? settings.iconColor : "#aaa"}
                            />
                        </View>
                    </TouchableWithoutFeedback>

                    {/* Redo Button */}
                    <TouchableWithoutFeedback
                        onPress={handleRedo}
                        disabled={isNoteDisabled}
                    >
                        <View style={styles.toolbarButton}>
                            <Icon
                                name="arrow-redo-outline"
                                size={16}
                                color={!isNoteDisabled ? settings.iconColor : "#aaa"}
                            />
                        </View>
                    </TouchableWithoutFeedback>

                    {/* Copy Button */}
                    <TouchableWithoutFeedback
                        onPress={handleCopy}
                        disabled={isNoteDisabled}
                    >
                        <View style={styles.toolbarButton}>
                            <Icon
                                name="copy-outline"
                                size={16}
                                color={!isNoteDisabled ? settings.iconColor : "#aaa"}
                            />
                        </View>
                    </TouchableWithoutFeedback>

                    {/* Paste Button */}
                    <TouchableWithoutFeedback
                        onPress={handlePaste}
                        disabled={isNoteDisabled}
                    >
                        <View style={styles.toolbarButton}>
                            <Icon
                                name="clipboard-outline"
                                size={16}
                                color={!isNoteDisabled ? settings.iconColor : "#aaa"}
                            />
                        </View>
                    </TouchableWithoutFeedback>

                    {/* Lock/Unlock Button */}
                    <TouchableWithoutFeedback
                        onPress={() => activeNote && toggleNoteLock(activeNote.id)}
                        disabled={isNoteDisabled}
                    >
                        <View style={styles.toolbarButton}>
                            <Icon
                                name={activeNote?.isLocked ? "lock-closed" : "lock-open"}
                                size={16}
                                color={!isNoteDisabled ? settings.iconColor : "#aaa"}
                            />
                        </View>
                    </TouchableWithoutFeedback>

                    {/* Delete Button */}
                    <TouchableWithoutFeedback
                        onPress={() => activeNote && handleDeleteNote(activeNote.id)}
                        disabled={isNoteDisabled}
                    >
                        <View style={styles.toolbarButton}>
                            <Icon
                                name="trash-outline"
                                size={16}
                                color={!isNoteDisabled ? "#C0392B" : "#aaa"}
                            />
                        </View>
                    </TouchableWithoutFeedback>

                    {/* Share Button */}
                    <TouchableWithoutFeedback
                        onPress={handleShare}
                        disabled={isNoteDisabled}
                    >
                        <View style={styles.toolbarButton}>
                            <Icon
                                name="share-social-outline"
                                size={16}
                                color={!isNoteDisabled ? settings.iconColor : "#aaa"}
                            />
                        </View>
                    </TouchableWithoutFeedback>

                    {/* Full Screen Button */}
                    <TouchableWithoutFeedback
                        onPress={handleToggleFullScreen}
                        disabled={isNoteDisabled}
                    >
                        <View style={styles.toolbarButton}>
                            <Icon
                                name={isFullScreen ? "contract-outline" : "expand-outline"}
                                size={16}
                                color={!isNoteDisabled ? settings.iconColor : "#aaa"}
                            />
                        </View>
                    </TouchableWithoutFeedback>
                </View>

                <Animated.View {...resizeResponder.panHandlers} style={[styles.resizeHandle, { backgroundColor: settings.bottomBarColor }]}>
                    <Icon name="resize-outline" size={10} color={settings.iconColor} />
                </Animated.View>
            </View>
        );
    };

    const renderNoteContent = () => {
        if (activeNoteId !== null && activeNote) {
            return renderNoteEditor();
        }
        return renderNoteList();
    };

    return (
        <View style={styles.container}>
            <StatusBar hidden />

            {/* Bubble or Note Window */}
            {!showNote ? renderBubble() : (
                <Animated.View
                    style={[
                        styles.note,
                        {
                            width: noteWidth,
                            height: noteHeight,
                            transform: [{ translateX: notePan.x }, { translateY: notePan.y }, { scale: scaleAnim }],
                            opacity: settings.opacity,
                            overflow: 'hidden'
                        },
                    ]}
                >
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

// --- স্টাইলশিট (Styles) ---
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
    note: {
        position: "absolute",
        backgroundColor: "#fff8dc",
        borderRadius: 12,
        elevation: 10,
    },
    topBarContainer: {
        height: 35,
        backgroundColor: "#f9e79f",
        borderTopLeftRadius: 12,
        borderTopRightRadius: 12,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    dragArea: {
        flex: 1,
        alignItems: 'flex-start',
        height: '100%',
        paddingLeft: 10,
        justifyContent: 'center',
    },
    noteTitle: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#333',
    },
    savingText: {
        fontSize: 12,
        color: '#27AE60',
        fontWeight: 'normal',
    },
    iconButton: {
        paddingHorizontal: 2,
        height: 35,
        justifyContent: 'center',
        alignItems: 'center',
    },
    listContentContainer: {
        paddingTop: 6,
        paddingHorizontal: 4,
        paddingBottom: 6,
    },
    listItemWrapper: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'stretch',
        backgroundColor: 'transparent',
        position: 'relative',
    },
    listItem: {
        flexGrow: 1,
        backgroundColor: '#fff',
        padding: 6,
        paddingLeft: 28,
        borderRadius: 6,
        borderTopRightRadius: 0,
        borderBottomRightRadius: 0,
        borderLeftWidth: 3,
        borderLeftColor: '#f9e79f',
        elevation: 2,
        position: 'relative',
        justifyContent: 'center',
        marginHorizontal: 2,
    },
    smallLockIconContainer: {
        position: 'absolute',
        left: 4,
        top: 4,
        width: 16,
        height: 16,
        borderRadius: 3,
        justifyContent: 'center',
        alignItems: 'center',
    },
    listItemTitle: {
        fontSize: 13,
        fontWeight: 'bold',
        color: '#333',
    },
    listItemPreview: {
        fontSize: 10,
        color: '#666',
    },
    sortButtonsContainer: {
        position: 'absolute',
        right: 25,
        top: 0,
        bottom: 0,
        width: 22,
        zIndex: 9,
        backgroundColor: '#eee',
        borderWidth: 1,
        borderColor: '#ddd',
        borderRightWidth: 0,
        flexDirection: 'column',
        justifyContent: 'space-around',
        alignItems: 'center',
    },
    sortButton: {
        paddingVertical: 1,
    },
    smallHeightListItem: {
        height: 25,
        paddingVertical: 3,
        paddingLeft: 28,
        paddingRight: 4,
        justifyContent: 'center',
        alignItems: 'flex-start',
    },
    disabledSortButton: {
        opacity: 0.3,
    },
    deleteButtonAbsolute: {
        position: 'absolute',
        right: 0,
        top: 0,
        bottom: 0,
        width: 25,
        zIndex: 10,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#f5f5f5',
        borderTopRightRadius: 6,
        borderBottomRightRadius: 6,
        elevation: 2,
    },
    noteContentArea: {
        flex: 1,
    },
    inputContainer: {
        flex: 1,
    },
    input: {
        minHeight: '100%',
        padding: 12,
        textAlignVertical: "top",
    },
    viewText: {
        padding: 0,
        textAlignVertical: "top",
    },

    dynamicLineHeight: {
        padding: 0,
        textAlignVertical: "top",
    },

    resizeHandle: {
        position: "absolute",
        width: 18,
        height: 18,
        right: 0,
        bottom: 0,
        borderRadius: 6,
        backgroundColor: "#f5e79e",
        justifyContent: "center",
        alignItems: "center",
        elevation: 5,
    },
    bottomToolbar: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        height: 32,
        backgroundColor: "#f9e79f",
        borderBottomLeftRadius: 12,
        borderBottomRightRadius: 12,
        paddingHorizontal: 17,
    },
    toolbarButton: {
        paddingHorizontal: 2,
        height: '100%',
        justifyContent: 'center',
        alignItems: 'center',
        flex: 1,
        marginHorizontal: 2,
    },
    centeredView: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
        backgroundColor: 'rgba(0,0,0,0.5)',
    },
    fullWidthModal: {
        width: '90%',
        maxHeight: '80%',
    },
    modalView: {
        width: '100%',
        backgroundColor: "white",
        borderRadius: 20,
        padding: 25,
        alignItems: "center",
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 4,
        elevation: 5,
    },
    modalTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        marginBottom: 20,
        textAlign: 'center',
    },
    settingLabel: {
        fontSize: 16,
        marginBottom: 5,
        alignSelf: 'flex-start',
        fontWeight: 'bold',
        marginTop: 10,
    },
    settingRow: {
        width: '100%',
        marginBottom: 20,
    },
    toggleContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginVertical: 10,
        width: '100%',
    },

    toggleLabel: {
        fontSize: 16,
        color: '#333',
        fontWeight: 'bold',
    },
    toggleButton: {
        width: 50,
        height: 28,
        borderRadius: 14,
        padding: 2,
        justifyContent: 'center',
    },
    toggleCircle: {
        width: 24,
        height: 24,
        borderRadius: 12,
        backgroundColor: 'white',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.2,
        shadowRadius: 1,
        elevation: 2,
    },
    toggleDescription: {
        fontSize: 12,
        color: '#666',
        marginTop: 5,
        fontStyle: 'italic',
    },
    slider: {
        width: '100%',
        height: 40,
    },
    closeButtonText: {
        color: "white",
        fontWeight: "bold",
        textAlign: "center",
    },
    passwordInputContainer: {
        width: '100%',
        flexDirection: 'row',
        alignItems: 'center',
        borderColor: '#ccc',
        borderWidth: 1,
        borderRadius: 8,
        marginBottom: 15,
        paddingRight: 10,
    },
    passwordInput: {
        flex: 1,
        height: 40,
        paddingHorizontal: 10,
        color: '#333'
    },
    securityAnswerInput: {
        flex: 1,
        height: 40,
        paddingHorizontal: 10,
        color: '#333'
    },
    passwordToggle: {
        padding: 5,
    },
    buttonRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        width: '100%',
        marginTop: 5,
    },
    modalButton: {
        flex: 1,
        borderRadius: 10,
        padding: 10,
        elevation: 2,
        marginHorizontal: 5,
    },
    saveButton: {
        backgroundColor: "#27AE60",
    },
    cancelButton: {
        backgroundColor: "#aaa",
    },
    passwordSettingsRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        width: '100%',
        marginTop: 8,
        marginBottom: 10,
    },
    passwordInfo: {
        width: '100%',
        padding: 10,
        backgroundColor: '#f8f9fa',
        borderRadius: 8,
        marginBottom: 10,
    },
    primaryPasswordText: {
        fontSize: 14,
        color: '#27AE60',
        fontWeight: 'bold',
        textAlign: 'center',
    },
    forgetPasswordText: {
        fontSize: 12,
        color: '#3498DB',
        textDecorationLine: 'underline',
        alignSelf: 'flex-start',
    },
    verifiedBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#d4edda',
        padding: 10,
        borderRadius: 5,
        marginTop: 10,
    },
    verifiedText: {
        color: '#155724',
        marginLeft: 8,
        fontWeight: 'bold',
        fontSize: 14,
    },
    changePasswordText: {
        fontSize: 12,
        color: '#2980B9',
        textDecorationLine: 'underline',
        alignSelf: 'flex-end',
    },
    colorOptionsContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        width: '100%',
        marginBottom: 15,
    },
    colorButton: {
        flex: 1,
        height: 40,
        marginHorizontal: 5,
        borderRadius: 5,
        justifyContent: 'center',
        alignItems: 'center',
        elevation: 2,
    },
    colorButtonText: {
        fontSize: 12,
        color: '#333',
    },
    // উন্নত Styles for Fast Scroll
    fastScrollIndicator: {
        position: 'absolute',
        right: 6,
        width: 20,
        height: 40,
        backgroundColor: 'rgba(200, 200, 200, 0.9)',
        borderRadius: 10,
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 1000,
        elevation: 3,
    },
    scrollIndicatorContent: {
        alignItems: 'center',
        justifyContent: 'space-between',
        height: 32,
    },
    scrollIndicatorLine: {
        width: 2,
        height: 8,
        backgroundColor: '#666',
        marginVertical: 2,
    },
    // ডিলিট কনফার্মেশন স্টাইল
    deleteConfirmOverlay: {
        position: 'absolute',
        bottom: 20,
        alignSelf: 'center',
        zIndex: 2000,
    },
    deleteConfirmCircle: {
        width: 65,
        height: 65,
        borderRadius: 30,
        backgroundColor: 'transparent',
        justifyContent: 'center',
        alignItems: 'center',
        elevation: 1,
        shadowColor: 'transparent',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 3,
    },
    // সিকিউরিটি প্রশ্ন স্টাইলস
    securitySection: {
        width: '100%',
        marginVertical: 20,
        padding: 15,
        backgroundColor: '#f8f9fa',
        borderRadius: 10,
        borderWidth: 1,
        borderColor: '#e9ecef',
    },
    securityStatusContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 10,
    },
    securityStatusIndicator: {
        width: 24,
        height: 24,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 10,
    },
    securityStatusText: {
        fontSize: 14,
        color: '#333',
        fontWeight: '500',
    },
    securityButton: {
        backgroundColor: '#3498DB',
        padding: 12,
        borderRadius: 8,
        alignItems: 'center',
        marginVertical: 5,
        elevation: 2,
    },
    securityButtonText: {
        color: 'white',
        fontWeight: 'bold',
        fontSize: 14,
    },
    securityDescription: {
        fontSize: 14,
        color: '#666',
        textAlign: 'center',
        marginBottom: 20,
        lineHeight: 20,
    },
    securityQuestionContainer: {
        width: '100%',
        marginBottom: 20,
        padding: 15,
        backgroundColor: '#f8f9fa',
        borderRadius: 10,
        borderWidth: 1,
        borderColor: '#e9ecef',
    },
    securityQuestionLabel: {
        fontSize: 14,
        fontWeight: 'bold',
        color: '#333',
        marginBottom: 8,
    },
    questionPickerContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 10,
    },
    selectedQuestionText: {
        fontSize: 14,
        color: '#555',
        flex: 1,
        paddingRight: 10,
        backgroundColor: '#f5f5f5',
        padding: 10,
        borderRadius: 5,
        marginVertical: 5,
        borderWidth: 1,
        borderColor: '#ddd',
    },
    changeQuestionButton: {
        backgroundColor: '#95a5a6',
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 5,
    },


    changeQuestionText: {
        color: 'white',
        fontSize: 11,
        fontWeight: 'bold',
    },
});