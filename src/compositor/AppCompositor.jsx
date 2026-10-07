import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { documents as seedDocuments, topics as seedTopics } from "../data";
import { api, setToken } from "../api";
import { enablePush } from "../push";

const STORAGE_KEY = "kn-profile";
const CONSENT_KEY = "kn-consent";

export const MONTHS = [
  "Јануари",
  "Февруари",
  "Март",
  "Април",
  "Мај",
  "Јуни",
  "Јули",
  "Август",
  "Септември",
  "Октомври",
  "Ноември",
  "Декември",
];

export const MONTHS_SHORT = ["Јан", "Фев", "Мар", "Апр", "Мај", "Јун", "Јул", "Авг", "Сеп", "Окт", "Ное", "Дек"];

export const defaultProfile = {
  name: "Илија Станковски",
  role: "Наставник по информатика",
  school: "ООУ „Кочо Рацин“",
  location: "Скопје, Македонија",
  areas: "Информатика, ИКТ, проектна настава",
  bio: "Посветен наставник со 12 години искуство, фокусиран на дигитална писменост и учење преку практични проекти. Верувам дека најдобрата училница е онаа во која секој ученик има простор да истражува.",
  interests: ["Дигитално образование", "Менторство", "Инклузија", "STEAM"],
  skills: ["Проектна настава", "Google Classroom", "Фасилитација", "Кодирање"],
};

const AppContext = createContext(null);

function profileFromUser(user) {
  return {
    ...defaultProfile,
    name: user.name,
    role: user.title || defaultProfile.role,
    school: user.school || defaultProfile.school,
    location: user.location || defaultProfile.location,
    areas: user.areas || defaultProfile.areas,
    bio: user.bio || defaultProfile.bio,
    interests: user.interests?.length ? user.interests : defaultProfile.interests,
    skills: user.skills?.length ? user.skills : defaultProfile.skills,
    accountId: user.id,
    access: user.role,
  };
}

function loadConsent() {
  try {
    const saved = localStorage.getItem(CONSENT_KEY);
    if (!saved) return null;
    const parsed = JSON.parse(saved);
    if (typeof parsed.analytics !== "boolean") return null;
    return { necessary: true, analytics: parsed.analytics };
  } catch {
    return null;
  }
}

function loadProfile() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return defaultProfile;
    return { ...defaultProfile, ...JSON.parse(saved) };
  } catch {
    return defaultProfile;
  }
}

function startOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function sameDay(a, b) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

export function monthCells(year, month) {
  const first = new Date(year, month, 1);
  const offset = (first.getDay() + 6) % 7;
  const count = new Date(year, month + 1, 0).getDate();
  const prevCount = new Date(year, month, 0).getDate();
  const cells = [];
  for (let index = offset; index > 0; index -= 1) {
    cells.push({ date: new Date(year, month - 1, prevCount - index + 1), outside: true });
  }
  for (let day = 1; day <= count; day += 1) {
    cells.push({ date: new Date(year, month, day), outside: false });
  }
  let next = 1;
  while (cells.length % 7 !== 0) {
    cells.push({ date: new Date(year, month + 1, next), outside: true });
    next += 1;
  }
  return cells;
}

export function weekCells(date) {
  const start = startOfDay(date);
  const offset = (start.getDay() + 6) % 7;
  start.setDate(start.getDate() - offset);
  return Array.from({ length: 7 }, (_, index) => {
    const day = new Date(start);
    day.setDate(start.getDate() + index);
    return { date: day, outside: day.getMonth() !== date.getMonth() };
  });
}

export function AppCompositor({ children }) {
  const [profile, setProfile] = useState(defaultProfile);
  const [user, setUser] = useState(null);
  const [signedIn, setSignedIn] = useState(false);
  const [authReady, setAuthReady] = useState(false);
  const [editing, setEditing] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [cursor, setCursor] = useState(() => new Date(2025, 5, 1));
  const [selected, setSelected] = useState(() => new Date(2025, 5, 12));
  const [view, setView] = useState("Месец");
  const [kind, setKind] = useState("Сите");
  const [openEventId, setOpenEventId] = useState(null);
  const [topics, setTopics] = useState(() => seedTopics.map((topic) => ({ ...topic, messages: topic.messages || [] })));
  const [documents, setDocuments] = useState(seedDocuments);
  const [joinedEvents, setJoinedEvents] = useState([]);
  const [joinedTrainings, setJoinedTrainings] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [alerts, setAlerts] = useState([]);
  const [forumCategory, setForumCategory] = useState("Сите");
  const [consent, setConsent] = useState(loadConsent);
  const [cookiesOpen, setCookiesOpen] = useState(false);

  useEffect(() => {
    if (signedIn) localStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
  }, [profile, signedIn]);

  useEffect(() => {
    let cancel = false;
    (async () => {
      try {
        const data = await api.me();
        if (!cancel && data.user) {
          setUser(data.user);
          setProfile(profileFromUser(data.user));
          setSignedIn(true);
        }
      } catch {
        setToken(null);
      }
      try {
        const data = await api.posts();
        if (!cancel) {
          setTopics((current) =>
            data.posts.map((post) => {
              const local = current.find((item) => item.id === post.id);
              return local && local.views > post.views ? { ...post, views: local.views } : post;
            }),
          );
        }
      } catch {
        /* keep the three seeded discussions if the database is unreachable */
      }
      try {
        const notes = await api.notifications();
        if (!cancel) {
          setUnreadCount(notes.count || 0);
          setAlerts(notes.items || []);
        }
      } catch {
        if (!cancel) setUnreadCount(0);
      }
      if (!cancel) setAuthReady(true);
      if (typeof Notification !== "undefined" && Notification.permission === "granted") enablePush().catch(() => {});
    })();
    return () => {
      cancel = true;
    };
  }, []);

  const markTopicView = useCallback(async (topicId) => {
    const data = await api.viewPost(topicId);
    setTopics((current) => current.map((topic) => (topic.id === topicId ? { ...topic, views: data.views } : topic)));
    setUnreadCount(data.unread || 0);
    if (data.items) setAlerts(data.items);
  }, []);

  const refreshAlerts = useCallback(async () => {
    const notes = await api.notifications();
    setUnreadCount(notes.count || 0);
    setAlerts(notes.items || []);
    return notes;
  }, []);

  const seeFeed = useCallback(async (kind) => {
    const notes = await api.seeFeed(kind);
    setUnreadCount(notes.count || 0);
    setAlerts(notes.items || []);
  }, []);

  useEffect(() => {
    if (!authReady) return undefined;
    const timer = setInterval(() => {
      refreshAlerts().catch(() => {});
    }, 30000);
    return () => clearInterval(timer);
  }, [authReady, refreshAlerts]);

  const value = useMemo(
    () => ({
      profile,
      user,
      signedIn,
      authReady,
      isAdmin: user?.role === "admin",
      editing,
      menuOpen,
      setMenuOpen,
      cursor,
      selected,
      view,
      kind,
      openEventId,
      setOpenEventId,
      setView,
      setKind,
      topics,
      documents,
      joinedEvents,
      joinedTrainings,
      unreadCount,
      alerts,
      forumCategory,
      setForumCategory,
      consent,
      cookiesOpen,
      setCookiesOpen,
      saveConsent(analytics) {
        const next = { necessary: true, analytics: Boolean(analytics), updated: new Date().toISOString() };
        localStorage.setItem(CONSENT_KEY, JSON.stringify(next));
        setConsent({ necessary: true, analytics: next.analytics });
        setCookiesOpen(false);
      },
      startEdit() {
        setEditing(true);
        setMenuOpen(false);
      },
      cancelEdit() {
        setEditing(false);
      },
      async saveProfile(next) {
        const data = await api.updateProfile({
          name: next.name.trim(),
          title: next.role.trim(),
          school: next.school.trim(),
          location: next.location.trim(),
          areas: next.areas.trim(),
          bio: next.bio.trim(),
          interests: next.interests.map((item) => item.trim()).filter(Boolean),
          skills: next.skills.map((item) => item.trim()).filter(Boolean),
        });
        setUser(data.user);
        setProfile(profileFromUser(data.user));
        setEditing(false);
        setSignedIn(true);
      },
      async signOut() {
        try {
          await api.logout();
        } catch {
          /* the local session still ends */
        }
        setToken(null);
        setUser(null);
        setSignedIn(false);
        setEditing(false);
        setMenuOpen(false);
        setUnreadCount(0);
      },
      async signIn(email, password) {
        try {
          const data = await api.login(email, password);
          setToken(data.token);
          setUser(data.user);
          setProfile(profileFromUser(data.user));
          setSignedIn(true);
          setMenuOpen(false);
          try {
            const notes = await api.notifications();
            setUnreadCount(notes.count || 0);
            setAlerts(notes.items || []);
          } catch {
            setUnreadCount(0);
          }
          return { ok: true, role: data.user.role };
        } catch (reason) {
          return { ok: false, error: reason.message };
        }
      },
      selectDate(date) {
        const next = startOfDay(date);
        setSelected(next);
        setCursor(new Date(next.getFullYear(), next.getMonth(), 1));
        setOpenEventId(null);
      },
      shift(direction) {
        if (view === "Недела") {
          const next = startOfDay(selected);
          next.setDate(next.getDate() + direction * 7);
          setSelected(next);
          setCursor(new Date(next.getFullYear(), next.getMonth(), 1));
          return;
        }
        const next = new Date(cursor.getFullYear(), cursor.getMonth() + direction, 1);
        setCursor(next);
        const day = Math.min(selected.getDate(), new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate());
        setSelected(new Date(next.getFullYear(), next.getMonth(), day));
        setOpenEventId(null);
      },
      async addTopic({ title, category, body }) {
        const data = await api.createPost({ title, category, body });
        setTopics((current) => [data.post, ...current.filter((item) => item.id !== data.post.id)]);
        return data.post.id;
      },
      async addReply(topicId, text) {
        const data = await api.reply(topicId, text);
        setTopics((current) => current.map((topic) => (topic.id === topicId ? data.post : topic)));
      },
      refreshAlerts,
      seeFeed,
      markTopicView,
      async deleteTopic(topicId) {
        await api.deletePost(topicId);
        setTopics((current) => current.filter((topic) => topic.id !== topicId));
      },
      addDocument(doc) {
        setDocuments((current) => [
          {
            title: doc.title.trim(),
            type: doc.type,
            folder: doc.folder,
            size: "12 KB",
            date: "денес",
            featured: false,
            body: doc.body.trim() || doc.title.trim(),
          },
          ...current,
        ]);
      },
      toggleEvent(id) {
        setJoinedEvents((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]));
      },
      toggleTraining(id) {
        setJoinedTrainings((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]));
      },
    }),
    [profile, user, signedIn, authReady, editing, menuOpen, cursor, selected, view, kind, openEventId, topics, documents, joinedEvents, joinedTrainings, unreadCount, alerts, forumCategory, consent, cookiesOpen, markTopicView, refreshAlerts, seeFeed],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) throw new Error("useApp must be used inside AppCompositor");
  return context;
}
