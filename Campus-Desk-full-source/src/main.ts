import './styles.css';
import { api } from '@appdeploy/client';

type Page = 'dashboard' | 'planner' | 'study' | 'tools' | 'assistant' | 'settings';
type Task = {
  id: string;
  title: string;
  subject: string;
  due: string;
  done: boolean;
  demo?: boolean;
};

const app = document.querySelector<HTMLDivElement>('#app');
if (!app) throw new Error('Campus Desk could not find its app root.');

const storageKey = 'campus-desk-tasks-v1';
let currentPage: Page = 'dashboard';
let activeResourceFilter = 'All';
let focusSeconds = 25 * 60;
let timerInterval: number | null = null;
let timerRunning = false;
const settingsKey = 'campus-desk-settings-v1';
const themeKey = 'campus-desk-theme-v1';
type AssistantSettings = { apiKey: string; model: string; endpoint: string };
let assistantSettings: AssistantSettings = loadAssistantSettings();
let assistantMessages: Array<{ role: 'user' | 'assistant'; content: string }> = [];
function loadAssistantSettings(): AssistantSettings {
  try {
    const saved = localStorage.getItem(settingsKey);
    if (saved) return { endpoint: 'https://api.openai.com/v1', model: 'gpt-4o-mini', ...JSON.parse(saved) };
  } catch { /* Use defaults if storage is unavailable. */ }
  return { apiKey: '', model: 'gpt-4o-mini', endpoint: 'https://api.openai.com/v1' };
}
function saveAssistantSettings(): void {
  try { localStorage.setItem(settingsKey, JSON.stringify(assistantSettings)); } catch { /* Settings remain available for this session. */ }
}
function syncThemeColor(theme: 'dark' | 'light'): void {
  const meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
  if (meta) meta.content = theme === 'dark' ? '#151b16' : '#f3f0e7';
}

function applyTheme(): void {
  let theme: 'dark' | 'light' = 'dark';
  try {
    const savedTheme = localStorage.getItem(themeKey);
    if (savedTheme === 'light' || savedTheme === 'dark') theme = savedTheme;
  } catch { /* Dark is the default. */ }
  document.documentElement.dataset.theme = theme;
  syncThemeColor(theme);
}
applyTheme();

const icons: Record<string, string> = {
  home: '<path d="m3 10 9-7 9 7"/><path d="M5 9v11h14V9"/><path d="M9 20v-6h6v6"/>',
  calendar:
    '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18"/>',
  book: '<path d="M4 4.5A2.5 2.5 0 0 1 6.5 2H20v17H6.5A2.5 2.5 0 0 0 4 21.5z"/><path d="M4 4.5v17M8 6h8M8 10h7"/>',
  zap: '<path d="m13 2-3 8h7l-6 12 1-9H6z"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  arrow: '<path d="M7 17 17 7M7 7h10v10"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
  trash: '<path d="M3 6h18M8 6V4h8v2m-10 0 1 14h10l1-14M10 10v6m4-6v6"/>',
  search: '<circle cx="10.8" cy="10.8" r="6.8"/><path d="m16 16 5 5"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  bookOpen:
    '<path d="M12 7v14M3 5.5A2.5 2.5 0 0 1 5.5 3H12v18H5.5A2.5 2.5 0 0 0 3 23z"/><path d="M21 5.5A2.5 2.5 0 0 0 18.5 3H12v18h6.5a2.5 2.5 0 0 1 2.5 2z"/>',
  external:
    '<path d="M14 3h7v7M10 14 21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>',
  target:
    '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>',
  chevron: '<path d="m9 18 6-6-6-6"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M4.93 4.93l1.42 1.42m11.3 11.3 1.42 1.42M2 12h2m16 0h2M4.93 19.07l1.42-1.42m11.3-11.3 1.42-1.42"/>',
  spark:
    '<path d="m12 3 1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/><path d="m19 16 .9 2.1L22 19l-2.1.9L19 22l-.9-2.1L16 19l2.1-.9z"/>',
};

function icon(name: string): string {
  return (
    '<span class="icon" aria-hidden="true"><svg viewBox="0 0 24 24">' +
    (icons[name] || icons.spark) +
    '</svg></span>'
  );
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, function (char) {
    const entities: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    };
    return entities[char] || char;
  });
}

function localISODate(offset = 0): string {
  const date = new Date();
  date.setDate(date.getDate() + offset);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return year + '-' + month + '-' + day;
}

function formatDue(dateText: string): string {
  if (!dateText) return 'No date';
  const target = new Date(dateText + 'T12:00:00');
  const today = new Date(localISODate() + 'T12:00:00');
  const gap = Math.round((target.getTime() - today.getTime()) / 86400000);
  if (gap === 0) return 'Due today';
  if (gap === 1) return 'Due tomorrow';
  if (gap === -1) return 'Due yesterday';
  if (gap < -1) return 'Overdue · ' + Math.abs(gap) + ' days';
  return (
    'Due ' +
    target.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
  );
}

function demoTasks(): Task[] {
  return [
    {
      id: 'example-maths',
      title: 'Revise linear equations',
      subject: 'Maths',
      due: localISODate(),
      done: false,
      demo: true,
    },
    {
      id: 'example-science',
      title: 'Review one science chapter',
      subject: 'Science',
      due: localISODate(2),
      done: false,
      demo: true,
    },
  ];
}

function loadTasks(): Task[] {
  try {
    const stored = localStorage.getItem(storageKey);
    if (stored !== null) {
      const parsed: unknown = JSON.parse(stored);
      return Array.isArray(parsed) ? (parsed as Task[]) : [];
    }
    const starter = demoTasks();
    localStorage.setItem(storageKey, JSON.stringify(starter));
    return starter;
  } catch {
    return [];
  }
}

let tasks: Task[] = loadTasks();
function saveTasks(): void {
  try {
    localStorage.setItem(storageKey, JSON.stringify(tasks));
  } catch {
    // The planner remains usable for the current session if storage is blocked.
  }
}

const navItems: Array<{ id: Page; label: string; icon: string }> = [
  { id: 'dashboard', label: 'Overview', icon: 'home' },
  { id: 'planner', label: 'My Planner', icon: 'calendar' },
  { id: 'study', label: 'Study Hub', icon: 'book' },
  { id: 'tools', label: 'Quick Tools', icon: 'zap' },
  { id: 'assistant', label: 'AI Assistant', icon: 'spark' },
  { id: 'settings', label: 'Settings', icon: 'target' },
];

const resources = [
  {
    title: 'NCERT Textbooks',
    category: 'NCERT',
    description: 'Find textbook PDFs for school subjects and classes.',
    url: 'https://ncert.nic.in/textbook.php',
    symbol: 'bookOpen',
    note: 'Official NCERT',
  },
  {
    title: 'ePathshala',
    category: 'NCERT',
    description: 'Digital textbooks and learning resources for students.',
    url: 'https://epathshala.nic.in/',
    symbol: 'book',
    note: 'Textbooks & audio',
  },
  {
    title: 'CBSE Academic',
    category: 'CBSE',
    description:
      'Explore academic resources, curriculum information and exam materials.',
    url: 'https://cbseacademic.nic.in/',
    symbol: 'calendar',
    note: 'Official CBSE',
  },
  {
    title: 'DIKSHA',
    category: 'Practice',
    description: 'Explore school learning content and practice materials.',
    url: 'https://diksha.gov.in/',
    symbol: 'target',
    note: 'Learning platform',
  },
  {
    title: 'NCERT e-Resources',
    category: 'Practice',
    description: 'Browse additional educational resources from NCERT.',
    url: 'https://www.ncert.nic.in/',
    symbol: 'spark',
    note: 'Official NCERT',
  },
  {
    title: 'National Digital Library',
    category: 'Practice',
    description: 'Search a wider collection of educational learning material.',
    url: 'https://ndl.iitkgp.ac.in/',
    symbol: 'bookOpen',
    note: 'Digital library',
  },
];

function navMarkup(mobile = false): string {
  return (
    '<nav class="' +
    (mobile ? 'mobile-nav' : 'nav-list') +
    '" aria-label="' +
    (mobile ? 'Mobile navigation' : 'Main navigation') +
    '">' +
    navItems
      .map(function (item) {
        return (
          '<button class="nav-btn ' +
          (currentPage === item.id ? 'active' : '') +
          '" data-page="' +
          item.id +
          '"' +
          (currentPage === item.id ? ' aria-current="page"' : '') +
          ' type="button">' +
          icon(item.icon) +
          '<span>' +
          item.label +
          '</span></button>'
        );
      })
      .join('') +
    '</nav>'
  );
}

function taskMarkup(task: Task): string {
  const tagClass =
    task.subject.toLowerCase() === 'science'
      ? ' science'
      : task.subject.toLowerCase() === 'english'
        ? ' english'
        : task.subject.toLowerCase() === 'hindi'
          ? ' hindi'
          : '';
  return (
    '<div class="task-row">' +
    '<button class="task-check ' +
    (task.done ? 'is-done' : '') +
    '" data-action="toggle-task" data-id="' +
    escapeHtml(task.id) +
    '" aria-label="' +
    (task.done ? 'Mark incomplete' : 'Mark complete') +
    ' task: ' +
    escapeHtml(task.title) +
    '">' +
    (task.done ? icon('check') : '') +
    '</button>' +
    '<div class="task-main"><div class="task-title ' +
    (task.done ? 'done' : '') +
    '">' +
    escapeHtml(task.title) +
    '</div>' +
    '<div class="task-meta"><span class="subject-tag' +
    tagClass +
    '">' +
    escapeHtml(task.subject) +
    '</span><span>' +
    escapeHtml(formatDue(task.due)) +
    '</span>' +
    (task.demo ? '<span>Sample</span>' : '') +
    '</div></div>' +
    '<div class="task-actions"><button class="icon-btn" data-action="delete-task" data-id="' +
    escapeHtml(task.id) +
    '" aria-label="Delete task: ' +
    escapeHtml(task.title) +
    '" title="Delete task">' +
    icon('trash') +
    '</button></div></div>'
  );
}

function taskListMarkup(list: Task[]): string {
  if (!list.length) {
    return (
      '<div class="empty-state"><span class="empty-icon">' +
      icon('check') +
      '</span><strong>Nothing on your list yet</strong><span>Add a task when you have something to remember.</span></div>'
    );
  }
  return '<div class="task-list">' + list.map(taskMarkup).join('') + '</div>';
}

function resourceMiniMarkup(resource: (typeof resources)[number]): string {
  return (
    '<a class="resource-mini" href="' +
    resource.url +
    '" target="_blank" rel="noopener noreferrer">' +
    '<span class="resource-symbol">' +
    icon(resource.symbol) +
    '</span><span style="flex:1"><strong>' +
    resource.title +
    '</strong><span>' +
    resource.note +
    '</span></span>' +
    icon('external') +
    '</a>'
  );
}

function renderDashboard(): string {
  const openTasks = tasks.filter(function (task) {
    return !task.done;
  }).length;
  const doneTasks = tasks.filter(function (task) {
    return task.done;
  }).length;
  const nextTasks = tasks
    .filter(function (task) {
      return !task.done;
    })
    .slice()
    .sort(function (a, b) {
      return a.due.localeCompare(b.due);
    })
    .slice(0, 3);
  const hour = new Date().getHours();
  const greeting =
    hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const today = new Date().toLocaleDateString('en-IN', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
  return (
    '<section class="portfolio-hero"><div class="portfolio-hero-copy"><div class="eyebrow"><span class="eyedot"></span> AN INDEPENDENT STUDENT PROJECT</div><p class="portfolio-meta">' +
    greeting +
    ' · ' +
    today +
    '</p><h1>School life,<br><em>less scattered.</em></h1><p class="hero-lead">A small, student-built toolkit for the everyday chaos of school. Plan your work, find the right resources, and get back to what matters.</p><div class="welcome-actions"><button class="btn primary" data-page="planner">' +
    icon('plus') +
    ' Try the planner</button><button class="btn secondary" data-page="study">' +
    icon('book') +
    ' Explore resources</button></div></div><div class="portfolio-hero-art"><div class="art-kicker">CAMPUS DESK / 01</div><div class="art-mark">CD<span>×</span></div><div class="art-bottom"><span>STUDENT UTILITY<br>FIELD NOTES</span><span>Made to be useful.</span></div></div></section>' +
    '<section class="portfolio-section-head"><div><div class="kicker">THE TOOLKIT</div><h2>Built for the real school day.</h2></div><p>No pretend school announcements or unnecessary clutter. Just a few handy tools that solve actual student problems.</p></section>' +
    '<div class="project-tool-grid"><button class="project-tool-card" data-page="planner"><span class="tool-index">01 / ORGANISE</span><span class="tool-symbol">' +
    icon('calendar') +
    '</span><div class="tool-tail"><strong>My Planner</strong>' +
    icon('arrow') +
    '</div><div class="tool-tail"><small>Homework, deadlines, done.</small></div></button><button class="project-tool-card" data-page="study"><span class="tool-index">02 / LEARN</span><span class="tool-symbol">' +
    icon('bookOpen') +
    '</span><div class="tool-tail"><strong>Study Hub</strong>' +
    icon('arrow') +
    '</div><div class="tool-tail"><small>Useful links, less searching.</small></div></button><button class="project-tool-card" data-page="tools"><span class="tool-index">03 / FOCUS</span><span class="tool-symbol">' +
    icon('clock') +
    '</span><div class="tool-tail"><strong>Focus Tools</strong>' +
    icon('arrow') +
    '</div><div class="tool-tail"><small>Timer and exam countdown.</small></div></button><button class="project-tool-card" data-page="tools"><span class="tool-index">04 / CALCULATE</span><span class="tool-symbol">' +
    icon('target') +
    '</span><div class="tool-tail"><strong>Marks Calc</strong>' +
    icon('arrow') +
    '</div><div class="tool-tail"><small>Quick percentage checks.</small></div></button></div>' +
    '<div class="portfolio-section-head"><div><div class="kicker">YOUR WORKSPACE</div><h2>Make the day a little easier.</h2></div><p>' +
    today +
    ' · Your tasks and completion status stay in this browser on this device.</p></div>' +
    '<div class="stats-grid"><div class="stat-card"><div class="stat-head"><span class="stat-label">Tasks to do</span><span class="stat-icon">' +
    icon('calendar') +
    '</span></div><div class="stat-value">' +
    openTasks +
    '</div><div class="stat-foot">Keep your next step clear</div></div>' +
    '<div class="stat-card"><div class="stat-head"><span class="stat-label">Completed</span><span class="stat-icon mint">' +
    icon('check') +
    '</span></div><div class="stat-value">' +
    doneTasks +
    '</div><div class="stat-foot">Every small win counts</div></div>' +
    '<div class="stat-card"><div class="stat-head"><span class="stat-label">Study links</span><span class="stat-icon amber">' +
    icon('bookOpen') +
    '</span></div><div class="stat-value">' +
    resources.length +
    '</div><div class="stat-foot">Useful resources, one place</div></div></div>' +
    '<div class="dashboard-grid"><section class="panel"><div class="panel-pad"><div class="panel-head"><div><div class="kicker">YOUR CHECKLIST</div><h2 style="margin-top:7px">Up next</h2><p class="subtle">' +
    today +
    '</p></div><button class="text-link" data-page="planner">Open planner ' +
    icon('chevron') +
    '</button></div>' +
    taskListMarkup(nextTasks) +
    (tasks.some(function (task) {
      return task.demo;
    })
      ? '<div class="example-note">These are sample tasks to help you try the planner. Delete them or replace them with your own.</div>'
      : '') +
    '<div style="margin-top:15px"><button class="btn secondary full-width" data-page="planner">' +
    icon('plus') +
    ' Add or manage tasks</button></div></div></section>' +
    '<div class="side-stack"><section class="feature-card"><div class="feature-icon">' +
    icon('spark') +
    '</div><h2>Small steps. Real progress.</h2><p>Pick one task, give it your attention, and start there. Your plan can change as your day does.</p><button class="btn" data-page="tools">Open focus tools ' +
    icon('arrow') +
    '</button></section>' +
    '<section class="panel"><div class="panel-pad"><div class="panel-head"><div><div class="kicker">START LEARNING</div><h2 style="margin-top:7px">Study shortcuts</h2></div></div><div class="resource-mini-list">' +
    resources.slice(0, 3).map(resourceMiniMarkup).join('') +
    '</div><button class="text-link" data-page="study" style="margin-top:13px">Browse all resources ' +
    icon('chevron') +
    '</button></div></section></div></div>' +
    '<section class="project-about-strip"><div><div class="kicker">ABOUT THE PROJECT</div><h2>Made by students,<br>for everyday student life.</h2></div><p>Campus Desk is an independent school-project concept built around a simple idea: make the useful stuff easier to find. It brings together planning, study links, and quick calculations without pretending to be an official school portal.<br><br>The goal is practicality first, with a little design personality on top.</p></section>' +
    '<div class="portfolio-section-head" style="margin-top:22px"><div><div class="kicker">THE PEOPLE BEHIND IT</div><h2>Two students. One useful idea.</h2></div></div>' +
    '<section class="creator-grid"><div class="creator-card"><div class="creator-initial">Z</div><div><strong>Zero</strong><span>Class 10D · KV Sector 5</span></div></div><div class="creator-card"><div class="creator-initial">Y</div><div><strong>Yash</strong><span>Class 10E · KV Delhi Cantt</span></div></div></section>'
  );
}

function renderPlanner(): string {
  const samplesExist = tasks.some(function (task) {
    return task.demo;
  });
  const ordered = tasks.slice().sort(function (a, b) {
    if (a.done !== b.done) return a.done ? 1 : -1;
    return a.due.localeCompare(b.due);
  });
  return (
    '<div class="page-heading"><div class="eyebrow"><span class="eyedot"></span> STAY ON TRACK</div><h1>My planner.</h1><p class="subtle">Capture homework, plan for tests, and tick things off as you go. Tasks are saved in this browser on this device.</p></div>' +
    '<div class="section-grid"><section class="panel"><div class="panel-pad"><div class="panel-head"><div><div class="kicker">NEW TASK</div><h2 style="margin-top:7px">Add to your list</h2><p class="subtle">Keep the task name short and clear.</p></div><span class="stat-icon">' +
    icon('plus') +
    '</span></div>' +
    '<form id="task-form"><div class="field"><label for="task-title">Task name</label><input id="task-title" name="title" maxlength="120" placeholder="e.g. Finish maths questions" required autocomplete="off"></div>' +
    '<div class="form-grid"><div class="field"><label for="task-subject">Subject</label><select id="task-subject" name="subject"><option>General</option><option>Maths</option><option>Science</option><option>English</option><option>Hindi</option><option>Social Science</option><option>Computer / AI</option></select></div>' +
    '<div class="field"><label for="task-due">Due date</label><input id="task-due" name="due" type="date" min="' +
    localISODate() +
    '" value="' +
    localISODate() +
    '" required></div></div>' +
    '<p class="form-error" id="task-error" aria-live="polite"></p><button class="btn primary full-width" type="submit">' +
    icon('plus') +
    ' Add task</button></form>' +
    (samplesExist
      ? '<div class="example-note">The starter examples are not school assignments. <button class="text-link" data-action="clear-examples" style="display:inline;padding:0 2px">Remove sample tasks</button></div>'
      : '') +
    '</div></section><section class="panel"><div class="panel-pad"><div class="panel-head"><div><div class="kicker">YOUR WORK</div><h2 style="margin-top:7px">Task list</h2><p class="subtle">' +
    tasks.filter(function (task) {
      return !task.done;
    }).length +
    ' unfinished · ' +
    tasks.filter(function (task) {
      return task.done;
    }).length +
    ' completed</p></div></div>' +
    taskListMarkup(ordered) +
    '</div></section></div>'
  );
}

function resourceCardMarkup(resource: (typeof resources)[number]): string {
  return (
    '<article class="resource-card"><div class="resource-card-top"><span class="resource-symbol large">' +
    icon(resource.symbol) +
    '</span><span class="subject-tag">' +
    resource.category +
    '</span></div>' +
    '<h3>' +
    resource.title +
    '</h3><p>' +
    resource.description +
    '</p><div class="resource-bottom"><span class="external-tag">' +
    resource.note +
    '</span><a class="text-link" href="' +
    resource.url +
    '" target="_blank" rel="noopener noreferrer">Open resource ' +
    icon('arrow') +
    '</a></div></article>'
  );
}

function renderStudy(): string {
  const categories = ['All', 'NCERT', 'CBSE', 'Practice'];
  return (
    '<div class="page-heading"><div class="eyebrow"><span class="eyedot"></span> LEARN SOMETHING</div><h1>Study Hub.</h1><p class="subtle">A small, curated collection of useful learning links. These resources lead to external websites; check the class and subject before using any material.</p></div>' +
    '<section class="panel"><div class="panel-pad"><div class="filter-row"><div class="search-box">' +
    icon('search') +
    '<input id="resource-search" type="search" placeholder="Search textbooks, platforms, resources…" aria-label="Search study resources"></div>' +
    '<div class="filter-pills" role="group" aria-label="Filter resources">' +
    categories
      .map(function (category) {
        return (
          '<button class="filter-pill ' +
          (activeResourceFilter === category ? 'active' : '') +
          '" data-resource-filter="' +
          category +
          '" aria-pressed="' +
          (activeResourceFilter === category) +
          '">' +
          category +
          '</button>'
        );
      })
      .join('') +
    '</div></div>' +
    '<p class="subtle" id="resource-count" style="margin-bottom:15px">' +
    resources.length +
    ' resources</p><div class="resource-grid" id="resource-grid">' +
    resources.map(resourceCardMarkup).join('') +
    '</div>' +
    '<div class="example-note" style="margin-top:17px">This is a student-made collection, not an official school noticeboard. Always rely on your teachers and official school communications for confirmed dates and instructions.</div></div></section>'
  );
}

function renderAssistant(): string {
  const transcript = assistantMessages.map(function (message) {
    return '<div class="chat-message ' + message.role + '"><div class="chat-role">' + (message.role === 'user' ? 'YOU' : 'CAMPUS AI') + '</div><div>' + escapeHtml(message.content).replace(/\n/g, '<br>') + '</div></div>';
  }).join('');
  return '<div class="page-heading"><div class="eyebrow"><span class="eyedot"></span> YOUR DATA, YOUR KEY</div><h1>AI assistant.</h1><p class="subtle">Ask for help planning your workload or understanding your study habits. The assistant can use your current planner tasks as context.</p></div>' +
  (!assistantSettings.apiKey ? '<div class="example-note">Add your API key in Settings before sending a message. No built-in key is provided.</div>' : '') +
  '<section class="panel"><div class="chat-transcript" id="chat-transcript">' + (transcript || '<div class="empty-state"><span class="empty-icon">' + icon('spark') + '</span><strong>What should we work on?</strong><span>Try: “Help me prioritize my unfinished tasks.”</span></div>') + '</div><form id="assistant-form" class="assistant-form"><div class="field"><label for="assistant-prompt">Your question</label><textarea id="assistant-prompt" rows="3" maxlength="3000" placeholder="Help me plan my study time…" required></textarea></div><div class="assistant-form-bottom"><span class="subtle">Your task titles, subjects, due dates and completion status may be sent to your chosen AI provider.</span><button class="btn primary" type="submit" ' + (!assistantSettings.apiKey ? 'disabled' : '') + '>Ask assistant ' + icon('arrow') + '</button></div><p class="form-error" id="assistant-error" aria-live="polite"></p></form></section><div class="example-note" style="margin-top:15px">AI answers can be wrong. Do not include passwords, private student records, or sensitive personal information.</div>';
}

function renderSettings(): string {
  return '<div class="page-heading"><div class="eyebrow"><span class="eyedot"></span> CONFIGURE YOUR WORKSPACE</div><h1>Settings.</h1><p class="subtle">Personalize the interface and connect your own AI provider.</p></div>' +
  '<div class="section-grid"><section class="panel"><div class="panel-pad"><div class="panel-head"><div><div class="kicker">APPEARANCE</div><h2 style="margin-top:7px">Theme</h2><p class="subtle">Dark mode starts on automatically.</p></div></div><div class="theme-choice"><button type="button" class="btn ' + ((document.documentElement.dataset.theme || 'dark') === 'dark' ? 'primary' : 'secondary') + '" data-action="theme-dark" aria-pressed="' + ((document.documentElement.dataset.theme || 'dark') === 'dark') + '">' + icon('sun') + ' Dark mode</button><button type="button" class="btn ' + (document.documentElement.dataset.theme === 'light' ? 'primary' : 'secondary') + '" data-action="theme-light" aria-pressed="' + (document.documentElement.dataset.theme === 'light') + '">' + icon('sun') + ' Light mode</button></div></div></section>' +
  '<section class="panel"><div class="panel-pad"><div class="panel-head"><div><div class="kicker">AI CONNECTION</div><h2 style="margin-top:7px">Bring your own API key.</h2><p class="subtle">Use an OpenAI-compatible chat completions endpoint.</p></div></div><form id="settings-form"><div class="field"><label for="api-endpoint">API base URL</label><input id="api-endpoint" type="url" value="' + escapeHtml(assistantSettings.endpoint) + '" placeholder="https://api.openai.com/v1" required></div><div class="field"><label for="api-model">Model name</label><input id="api-model" value="' + escapeHtml(assistantSettings.model) + '" placeholder="gpt-4o-mini" required></div><div class="field"><label for="api-key">API key</label><input id="api-key" type="password" value="' + escapeHtml(assistantSettings.apiKey) + '" placeholder="Paste your own API key" autocomplete="off"><span class="subtle">Stored in this browser&#39;s local storage, not in the website source code. It is sent to this app&#39;s backend only to forward your request to the provider you configure.</span></div><div class="settings-actions"><button class="btn primary" type="submit">Save settings</button><button class="btn secondary" type="button" data-action="clear-api-key">Clear key</button></div><p class="form-error" id="settings-status" aria-live="polite"></p></form></div></section></div>' +
  '<section class="panel" style="margin-top:16px"><div class="panel-pad"><div class="kicker">DATA & PRIVACY</div><h2 style="margin-top:7px">What gets shared?</h2><p class="subtle">When you ask the AI assistant, your prompt and a summary of planner tasks are sent to the AI provider through the app backend. The backend does not save your key or chat history. Your provider may process requests under its own policies. Avoid sensitive information.</p><div class="settings-actions"><button class="btn secondary" data-action="clear-chat">Clear assistant chat</button><button class="btn secondary" data-action="clear-tasks">Clear all planner tasks</button></div></div></section>';
}

function renderTools(): string {
  return (
    '<div class="page-heading"><div class="eyebrow"><span class="eyedot"></span> WORK SMARTER</div><h1>Quick tools.</h1><p class="subtle">A couple of lightweight tools for focus and planning. No account required.</p></div>' +
    '<div class="tool-grid"><section class="tool-card"><span class="tool-symbol">' +
    icon('clock') +
    '</span><div class="kicker">FOCUS SESSION</div><h2 style="margin-top:7px">One thing at a time.</h2><p>A 25-minute focus timer. Start when you are ready, pause when you need to, and reset for a fresh session.</p>' +
    '<div class="timer-face" id="focus-time" aria-live="polite">' +
    formatTime(focusSeconds) +
    '</div><div class="timer-caption" id="focus-status">Ready when you are.</div><div class="tool-actions"><button class="btn primary" id="timer-start" data-action="timer-start">' +
    (timerRunning ? 'Pause' : 'Start focus') +
    '</button><button class="btn secondary" data-action="timer-reset">Reset</button></div></section>' +
    '<section class="tool-card"><span class="tool-symbol">' +
    icon('calendar') +
    '</span><div class="kicker">DATE PLANNER</div><h2 style="margin-top:7px">Exam countdown.</h2><p>Choose your exam date to see how many days you have left. This does not assume any official school exam date.</p>' +
    '<form id="countdown-form"><div class="field" style="margin-top:19px"><label for="exam-date">Your exam date</label><input id="exam-date" type="date" min="' +
    localISODate() +
    '" required></div><button class="btn primary full-width" type="submit">Calculate countdown ' +
    icon('arrow') +
    '</button></form><div class="countdown-result" id="countdown-result" aria-live="polite">Choose a date to start planning.</div></section>' +
    '<section class="tool-card"><span class="tool-symbol">' +
    icon('target') +
    '</span><div class="kicker">MARKS CALCULATOR</div><h2 style="margin-top:7px">Check a percentage.</h2><p>Enter the marks scored and the total marks to calculate your percentage.</p>' +
    '<form id="score-form"><div class="form-grid" style="margin-top:18px"><div class="field"><label for="marks-scored">Marks scored</label><input id="marks-scored" type="number" min="0" step="any" placeholder="e.g. 34" required></div><div class="field"><label for="marks-total">Total marks</label><input id="marks-total" type="number" min="0.01" step="any" placeholder="e.g. 40" required></div></div><p class="form-error" id="score-error" aria-live="polite"></p><button class="btn secondary full-width" type="submit">Calculate percentage</button></form><div class="countdown-result score-result" id="score-result" aria-live="polite">Your result will appear here.</div></section>' +
    '<section class="feature-card"><div class="feature-icon">' +
    icon('spark') +
    '</div><div class="kicker" style="color:#c1c9ff">A SIMPLE REMINDER</div><h2 style="margin-top:12px">You do not need a perfect plan.</h2><p>Start with a realistic task. Give it a little focused time. Adjust the plan when you learn more.</p><button class="btn" data-page="planner">Back to planner ' +
    icon('arrow') +
    '</button></section></div>'
  );
}

function formatTime(seconds: number): string {
  const safe = Math.max(0, seconds);
  return (
    String(Math.floor(safe / 60)).padStart(2, '0') +
    ':' +
    String(safe % 60).padStart(2, '0')
  );
}

function updateTimerUI(): void {
  const face = app.querySelector<HTMLElement>('#focus-time');
  const startButton = app.querySelector<HTMLButtonElement>('#timer-start');
  const status = app.querySelector<HTMLElement>('#focus-status');
  if (face) face.textContent = formatTime(focusSeconds);
  if (startButton)
    startButton.textContent = timerRunning
      ? 'Pause'
      : focusSeconds === 0
        ? 'Start again'
        : 'Start focus';
  if (status && focusSeconds === 0)
    status.textContent = 'Session complete. Take a short break.';
  else if (status && !timerRunning && focusSeconds === 25 * 60)
    status.textContent = 'Ready when you are.';
  else if (status && !timerRunning)
    status.textContent = 'Paused. Resume whenever you are ready.';
  else if (status) status.textContent = 'You are in a focus session.';
}

function renderResourceGrid(): void {
  const grid = app.querySelector<HTMLElement>('#resource-grid');
  if (!grid) return;
  const search = app.querySelector<HTMLInputElement>('#resource-search');
  const query = (search ? search.value : '').trim().toLowerCase();
  const filtered = resources.filter(function (resource) {
    const matchesCategory =
      activeResourceFilter === 'All' ||
      resource.category === activeResourceFilter;
    const searchable = [
      resource.title,
      resource.category,
      resource.description,
      resource.note,
    ]
      .join(' ')
      .toLowerCase();
    return matchesCategory && searchable.includes(query);
  });
  grid.innerHTML = filtered.length
    ? filtered.map(resourceCardMarkup).join('')
    : '<div class="empty-state" style="grid-column:1/-1"><span class="empty-icon">' +
      icon('search') +
      '</span><strong>No matching resources</strong><span>Try a different search or filter.</span></div>';
  const count = app.querySelector<HTMLElement>('#resource-count');
  if (count)
    count.textContent =
      filtered.length + (filtered.length === 1 ? ' resource' : ' resources');
  app
    .querySelectorAll<HTMLButtonElement>('[data-resource-filter]')
    .forEach(function (button) {
      const active = button.dataset.resourceFilter === activeResourceFilter;
      button.classList.toggle('active', active);
      button.setAttribute('aria-pressed', String(active));
    });
}

function render(): void {
  const activeLabel =
    navItems.find(function (item) {
      return item.id === currentPage;
    })?.label || 'Dashboard';
  const dateLabel = new Date().toLocaleDateString('en-IN', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
  let pageContent = '';
  if (currentPage === 'dashboard') pageContent = renderDashboard();
  else if (currentPage === 'planner') pageContent = renderPlanner();
  else if (currentPage === 'study') pageContent = renderStudy();
  else if (currentPage === 'assistant') pageContent = renderAssistant();
  else if (currentPage === 'settings') pageContent = renderSettings();
  else pageContent = renderTools();

  app.innerHTML =
    '<a class="skip-link" href="#main-content">Skip to main content</a><div class="app-shell"><aside class="sidebar"><div class="brand"><span class="brand-mark">K</span><div><div class="brand-name">Campus Desk</div><div class="brand-caption">KV Delhi Cantt</div></div></div>' +
    '<div class="side-label">Workspace</div>' +
    navMarkup() +
    '<div class="sidebar-spacer"></div>' +
    '<div class="side-note"><div class="mini-kicker">Made for the school day</div><p>A practical little space for planning, studying, and staying organized.</p></div>' +
    '<div class="side-footer">A student-made project<br><strong>Zero</strong> · Class 10D, KV Sector 5<br><strong>Yash</strong> · Class 10E, KV Delhi Cantt</div></aside>' +
    '<div class="main-area"><div class="mobile-brand"><span class="brand-mark">K</span><div><div class="brand-name">Campus Desk</div><div class="brand-caption">KV Delhi Cantt</div></div></div>' +
    '<header class="topbar"><div class="breadcrumb">Campus Desk <span class="breadcrumb-separator" aria-hidden="true">/</span> <strong>' +
    activeLabel +
    '</strong></div><div class="topbar-right"><span class="status-pill"><span class="status-dot" aria-hidden="true"></span> Student-built project</span><button type="button" class="avatar settings-shortcut" data-page="settings" aria-label="Open settings" title="Settings">' + icon('target') + '</button></div></header>' +
    '<main id="main-content" class="view-wrap" tabindex="-1">' +
    pageContent +
    '<footer class="credit-strip"><span>Student utility concept · Not an official school website</span><span>Built by <span class="credit-names">Zero</span> (Class 10D, KV Sector 5) <span aria-hidden="true">·</span> <span class="credit-names">Yash</span> (Class 10E, KV Delhi Cantt)</span></footer></main></div></div>' +
    navMarkup(true);
  updateTimerUI();
}

app.addEventListener('click', function (event: MouseEvent) {
  const target = event.target;
  if (!(target instanceof HTMLElement)) return;

  const pageButton = target.closest<HTMLButtonElement>('[data-page]');
  if (pageButton && pageButton.dataset.page) {
    currentPage = pageButton.dataset.page as Page;
    render();
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    window.scrollTo({ top: 0, behavior: reduceMotion ? 'auto' : 'smooth' });
    return;
  }

  const filterButton = target.closest<HTMLButtonElement>(
    '[data-resource-filter]'
  );
  if (filterButton && filterButton.dataset.resourceFilter) {
    activeResourceFilter = filterButton.dataset.resourceFilter;
    renderResourceGrid();
    return;
  }

  const actionButton = target.closest<HTMLButtonElement>('[data-action]');
  if (!actionButton) return;
  const action = actionButton.dataset.action;
  const id = actionButton.dataset.id;
  if (action === 'theme-dark' || action === 'theme-light') {
    const theme = action === 'theme-dark' ? 'dark' : 'light';
    document.documentElement.dataset.theme = theme;
    syncThemeColor(theme);
    try { localStorage.setItem(themeKey, theme); } catch { /* Session theme still works. */ }
    render();
    return;
  }
  if (action === 'clear-api-key') {
    assistantSettings.apiKey = '';
    saveAssistantSettings();
    render();
    const status = app.querySelector<HTMLElement>('#settings-status');
    if (status) status.textContent = 'API key cleared from this browser.';
    return;
  }
  if (action === 'clear-chat') { assistantMessages = []; render(); return; }
  if (action === 'clear-tasks') {
    if (window.confirm('Delete every planner task from this browser?')) { tasks = []; saveTasks(); render(); }
    return;
  }

  if (action === 'toggle-task' && id) {
    tasks = tasks.map(function (task) {
      return task.id === id ? { ...task, done: !task.done } : task;
    });
    saveTasks();
    render();
  } else if (action === 'delete-task' && id) {
    const task = tasks.find(function (item) {
      return item.id === id;
    });
    if (
      task &&
      window.confirm('Delete "' + task.title + '" from your planner?')
    ) {
      tasks = tasks.filter(function (item) {
        return item.id !== id;
      });
      saveTasks();
      render();
    }
  } else if (action === 'clear-examples') {
    tasks = tasks.filter(function (task) {
      return !task.demo;
    });
    saveTasks();
    render();
  } else if (action === 'timer-start') {
    if (timerRunning) {
      if (timerInterval !== null) window.clearInterval(timerInterval);
      timerInterval = null;
      timerRunning = false;
    } else {
      if (focusSeconds === 0) focusSeconds = 25 * 60;
      timerRunning = true;
      timerInterval = window.setInterval(function () {
        focusSeconds = Math.max(0, focusSeconds - 1);
        if (focusSeconds === 0) {
          if (timerInterval !== null) window.clearInterval(timerInterval);
          timerInterval = null;
          timerRunning = false;
        }
        updateTimerUI();
      }, 1000);
    }
    updateTimerUI();
  } else if (action === 'timer-reset') {
    if (timerInterval !== null) window.clearInterval(timerInterval);
    timerInterval = null;
    timerRunning = false;
    focusSeconds = 25 * 60;
    updateTimerUI();
  }
});

app.addEventListener('submit', async function (event: SubmitEvent) {
  const target = event.target;
  if (!(target instanceof HTMLFormElement)) return;
  event.preventDefault();

  if (target.id === 'settings-form') {
    const endpoint = target.querySelector<HTMLInputElement>('#api-endpoint')?.value.trim() || '';
    const model = target.querySelector<HTMLInputElement>('#api-model')?.value.trim() || '';
    const apiKey = target.querySelector<HTMLInputElement>('#api-key')?.value.trim() || '';
    const status = app.querySelector<HTMLElement>('#settings-status');
    try {
      const parsed = new URL(endpoint);
      if (parsed.protocol !== 'https:' && parsed.hostname !== 'localhost') throw new Error('Use an HTTPS endpoint.');
      if (!model) throw new Error('Enter a model name.');
      assistantSettings = { endpoint: endpoint.replace(/\/$/, ''), model, apiKey };
      saveAssistantSettings();
      if (status) status.textContent = 'Settings saved in this browser.';
    } catch (e) { if (status) status.textContent = e instanceof Error ? e.message : 'Check the API URL.'; }
    return;
  }

  if (target.id === 'assistant-form') {
    const prompt = target.querySelector<HTMLTextAreaElement>('#assistant-prompt')?.value.trim() || '';
    const error = app.querySelector<HTMLElement>('#assistant-error');
    if (!prompt || !assistantSettings.apiKey) { if (error) error.textContent = 'Add your API key in Settings and enter a question.'; return; }
    const context = tasks.map(t => ({ title: t.title, subject: t.subject, due: t.due, done: t.done }));
    assistantMessages.push({ role: 'user', content: prompt });
    render();
    const submit = app.querySelector<HTMLButtonElement>('#assistant-form button[type="submit"]');
    if (submit) { submit.disabled = true; submit.textContent = 'Thinking…'; }
    try {
      const response = await api.post('/api/assistant', { endpoint: assistantSettings.endpoint, model: assistantSettings.model, apiKey: assistantSettings.apiKey, prompt, context, history: assistantMessages.slice(-8) });
      const answer = String(response.data?.answer || 'The provider returned an empty answer.');
      assistantMessages.push({ role: 'assistant', content: answer });
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Request failed.';
      assistantMessages.push({ role: 'assistant', content: 'I could not reach the AI provider. Check the endpoint, model, API key, and provider billing/CORS settings. Details: ' + message });
    }
    render();
    return;
  }

  if (target.id === 'task-form') {
    const titleField = target.querySelector<HTMLInputElement>('[name="title"]');
    const subjectField =
      target.querySelector<HTMLSelectElement>('[name="subject"]');
    const dueField = target.querySelector<HTMLInputElement>('[name="due"]');
    const error = app.querySelector<HTMLElement>('#task-error');
    const title = titleField?.value.trim() || '';
    const subject = subjectField?.value || 'General';
    const due = dueField?.value || '';
    if (!title) {
      if (error) error.textContent = 'Enter a task name before adding it.';
      titleField?.focus();
      return;
    }
    if (!due) {
      if (error) error.textContent = 'Choose a due date for this task.';
      dueField?.focus();
      return;
    }
    tasks.unshift({
      id:
        'task-' +
        Date.now().toString(36) +
        '-' +
        Math.random().toString(36).slice(2, 7),
      title,
      subject,
      due,
      done: false,
    });
    saveTasks();
    render();
    return;
  }

  if (target.id === 'countdown-form') {
    const dateField = target.querySelector<HTMLInputElement>('#exam-date');
    const result = app.querySelector<HTMLElement>('#countdown-result');
    const dateText = dateField?.value || '';
    if (!dateText || !result) return;
    const examDate = new Date(dateText + 'T00:00:00');
    const today = new Date(localISODate() + 'T00:00:00');
    const days = Math.round((examDate.getTime() - today.getTime()) / 86400000);
    if (!Number.isFinite(days) || days < 0)
      result.textContent = 'Choose today or a future date.';
    else if (days === 0)
      result.textContent = 'Your exam is today. Make a calm, realistic plan.';
    else
      result.textContent =
        days +
        (days === 1 ? ' day left.' : ' days left.') +
        ' One step at a time.';
    return;
  }

  if (target.id === 'score-form') {
    const scoredField = target.querySelector<HTMLInputElement>('#marks-scored');
    const totalField = target.querySelector<HTMLInputElement>('#marks-total');
    const error = app.querySelector<HTMLElement>('#score-error');
    const result = app.querySelector<HTMLElement>('#score-result');
    const scored = Number(scoredField?.value);
    const total = Number(totalField?.value);
    if (error) error.textContent = '';
    if (
      !scoredField?.value ||
      !totalField?.value ||
      !Number.isFinite(scored) ||
      !Number.isFinite(total) ||
      total <= 0 ||
      scored < 0 ||
      scored > total
    ) {
      if (error)
        error.textContent =
          'Enter valid marks, with scored marks no higher than total marks.';
      if (result) result.textContent = 'Check the numbers and try again.';
      return;
    }
    if (result)
      result.textContent = ((scored / total) * 100).toFixed(1) + '% scored';
  }
});

app.addEventListener('input', function (event: Event) {
  const target = event.target;
  if (target instanceof HTMLInputElement && target.id === 'resource-search')
    renderResourceGrid();
});

render();
