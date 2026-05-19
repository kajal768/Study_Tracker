const todayKey = new Date().toISOString().slice(0, 10);

const defaultData = {
  selectedDate: todayKey,
  activeTaskId: null,
  tasks: [
    {
      id: 1,
      name: 'Exercise + Meditation',
      category: 'Health',
      startTime: '19:30',
      endTime: '20:00',
      duration: 30,
      done: false,
      status: 'pending',
      alertedDate: ''
    },
    {
      id: 2,
      name: 'DSA Practice',
      category: 'DSA',
      startTime: '20:00',
      endTime: '20:45',
      duration: 45,
      done: false,
      status: 'pending',
      alertedDate: ''
    },
    {
      id: 3,
      name: 'Entrance Topic',
      category: 'Entrance',
      startTime: '20:45',
      endTime: '21:30',
      duration: 45,
      done: false,
      status: 'pending',
      alertedDate: ''
    },
    {
      id: 4,
      name: 'English Speaking 15 min',
      category: 'English',
      startTime: '21:30',
      endTime: '21:45',
      duration: 15,
      done: false,
      status: 'pending',
      alertedDate: ''
    }
  ],
  goals: [
    { id: 1, name: 'DSA Questions', target: 60, done: 8 },
    { id: 2, name: 'Entrance Questions', target: 500, done: 45 },
    { id: 3, name: 'English Speaking Days', target: 25, done: 4 }
  ],
  monthlyProgress: [4, 5, 3, 6, 5, 2, 4, 6, 7, 5, 6, 4, 7, 8, 5, 6, 7, 4, 6, 7, 5, 6, 8, 7, 6, 5, 7, 8, 6, 7],
  notes: ''
};

let savedData = JSON.parse(localStorage.getItem('studyTrackerData'));

if (!savedData || !Array.isArray(savedData.tasks)) {
  savedData = defaultData;
}

let data = {
  ...defaultData,
  ...savedData,
  tasks: savedData.tasks.map(task => ({
    ...task,
    startTime: task.startTime || task.time || '',
    endTime: task.endTime || '',
    duration: Number(task.duration || 25),
    status: task.done ? 'completed' : (task.status || 'pending'),
    alertedDate: task.alertedDate || ''
  }))
};

let chart = null;
let timerInterval = null;
let activeTaskId = data.activeTaskId || null;
let totalSeconds = 0;
let remainingSeconds = 0;
let timerRunning = false;

const qs = selector => document.querySelector(selector);
const qsa = selector => document.querySelectorAll(selector);

function saveData() {
  data.activeTaskId = activeTaskId;
  localStorage.setItem('studyTrackerData', JSON.stringify(data));
}

function formatTime(time) {
  if (!time) return '--';

  const [hour, minute] = time.split(':').map(Number);
  const suffix = hour >= 12 ? 'PM' : 'AM';
  const displayHour = hour % 12 || 12;

  return `${displayHour}:${String(minute).padStart(2, '0')} ${suffix}`;
}

function getTodayString() {
  return new Date().toISOString().slice(0, 10);
}

function calculateDuration(startTime, endTime) {
  if (!startTime || !endTime) return 25;

  const [sh, sm] = startTime.split(':').map(Number);
  const [eh, em] = endTime.split(':').map(Number);

  let startMinutes = sh * 60 + sm;
  let endMinutes = eh * 60 + em;

  if (endMinutes <= startMinutes) {
    endMinutes += 24 * 60;
  }

  return Math.max(endMinutes - startMinutes, 1);
}

function addMinutesToTime(startTime, minutes) {
  if (!startTime || !minutes) return '';

  const [h, m] = startTime.split(':').map(Number);
  const date = new Date();

  date.setHours(h);
  date.setMinutes(m + Number(minutes));

  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

function setCurrentDate() {
  const datePicker = qs('#datePicker');
  if (datePicker) {
    datePicker.value = data.selectedDate || todayKey;
  }
}

function setTodayTheme() {
  const themes = [
    'Sunday: Mock + Planning',
    'Monday: DSA Deep Work',
    'Tuesday: DSA Practice',
    'Wednesday: Entrance Quant',
    'Thursday: Reasoning Practice',
    'Friday: Job Prep',
    'Saturday: Mixed Revision'
  ];

  qs('#todayTheme').textContent = themes[new Date().getDay()];
}

function getSortedTasks() {
  return [...data.tasks].sort((a, b) => {
    const aTime = a.startTime || '99:99';
    const bTime = b.startTime || '99:99';
    return aTime.localeCompare(bTime);
  });
}

function updateNextAlarm() {
  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  const pending = data.tasks
    .filter(task => task.startTime && !task.done)
    .map(task => {
      const [h, m] = task.startTime.split(':').map(Number);
      return { ...task, minutes: h * 60 + m };
    })
    .filter(task => task.minutes >= currentMinutes)
    .sort((a, b) => a.minutes - b.minutes)[0];

  qs('#nextAlarmText').textContent = pending
    ? `${formatTime(pending.startTime)} - ${pending.name}`
    : 'No pending task today';
}

function updateActiveTimerText() {
  const activeTask = data.tasks.find(task => task.id === activeTaskId);

  qs('#activeTimerText').textContent = activeTask
    ? `${activeTask.name} running`
    : 'No task running';

  qs('#runningTaskTitle').textContent = activeTask
    ? activeTask.name
    : 'No task selected';

  qs('#quoteText').textContent = activeTask
    ? `${formatTime(activeTask.startTime)} - ${formatTime(activeTask.endTime)} | ${activeTask.duration} min focus`
    : 'Daily Tasks me jaake kisi task ka Start button dabao.';
}

function renderStats() {
  const total = data.tasks.length;
  const done = data.tasks.filter(task => task.done).length;
  const percent = total ? Math.round((done / total) * 100) : 0;

  const studyMinutes = data.tasks
    .filter(task => task.done)
    .reduce((sum, task) => sum + Number(task.duration || 0), 0);

  qs('#todayPercent').textContent = `${percent}%`;
  qs('#completedCount').textContent = `${done}/${total}`;
  qs('#studyTimeCount').textContent = `${studyMinutes}m`;
  qs('#streakCount').textContent = percent >= 70 ? '🔥 1' : '0';
}

function getTaskStatusBadge(task) {
  if (task.done) {
    return '<span class="badge green">Completed</span>';
  }

  if (task.status === 'running') {
    return '<span class="badge orange">Running</span>';
  }

  return '<span class="badge pink">Pending</span>';
}

function taskTemplate(task) {
  return `
    <div class="task-row ${task.done ? 'done' : ''}">
      <div class="task-time-box">
        ${formatTime(task.startTime)}
      </div>

      <div class="task-info">
        <strong>${task.name}</strong>
        <small>
          ${formatTime(task.startTime)} - ${formatTime(task.endTime)}
          • ${task.duration} minutes
          • ${task.category}
        </small>

        <div class="task-meta">
          ${getTaskStatusBadge(task)}
          <span class="badge">⏳ ${task.duration}m</span>
          <span class="badge">🎯 ${task.category}</span>
        </div>
      </div>

      <div class="task-actions">
        ${
          task.done
            ? '<button class="btn small light" disabled>✓ Done</button>'
            : `
              <button class="btn small green" onclick="startTask(${task.id})">
                ${task.status === 'running' ? 'Running' : 'Start'}
              </button>
              <button class="btn small light" onclick="completeTask(${task.id})">
                Complete
              </button>
            `
        }
      </div>
    </div>
  `;
}

function renderTasks() {
  const sortedTasks = getSortedTasks();

  qs('#taskList').innerHTML = sortedTasks.map(taskTemplate).join('');
  qs('#todayTasks').innerHTML = sortedTasks.slice(0, 5).map(taskTemplate).join('');

  renderSchedule();
  updateNextAlarm();
  updateActiveTimerText();
  renderStats();
  renderChart();
  saveData();
}

function renderSchedule() {
  const sortedTasks = getSortedTasks().filter(task => task.startTime);

  qs('#scheduleList').innerHTML = sortedTasks.length
    ? sortedTasks.map(taskTemplate).join('')
    : `
      <div class="motivation">
        <strong>No alarms yet</strong>
        <p>Add your study time and task from above.</p>
      </div>
    `;
}

function renderGoals() {
  qs('#goalList').innerHTML = data.goals.map(goal => {
    const percent = goal.target
      ? Math.min(Math.round((goal.done / goal.target) * 100), 100)
      : 0;

    return `
      <div class="goal-item">
        <div class="goal-top">
          <span>${goal.name}</span>
          <span>${goal.done}/${goal.target}</span>
        </div>
        <div class="progress">
          <span style="width:${percent}%"></span>
        </div>
      </div>
    `;
  }).join('');

  renderStats();
  saveData();
}

function renderChart() {
  const canvas = qs('#progressChart');

  if (!canvas || typeof Chart === 'undefined') return;

  const ctx = canvas.getContext('2d');
  const labels = Array.from({ length: 30 }, (_, i) => i + 1);

  if (chart) chart.destroy();

  const gradient = ctx.createLinearGradient(0, 0, 520, 0);
  gradient.addColorStop(0, '#7c3aed');
  gradient.addColorStop(0.45, '#2563eb');
  gradient.addColorStop(1, '#ec4899');

  chart = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [
        {
          label: 'Daily Score',
          data: data.monthlyProgress,
          borderColor: gradient,
          backgroundColor: 'rgba(124, 58, 237, 0.10)',
          borderWidth: 4,
          tension: 0.42,
          pointRadius: 5,
          pointHoverRadius: 8,
          pointBackgroundColor: '#ffffff',
          pointBorderColor: gradient,
          pointBorderWidth: 3,
          fill: true
        }
      ]
    },
    options: {
      responsive: true,
      animation: {
        duration: 900,
        easing: 'easeOutQuart'
      },
      plugins: {
        legend: {
          display: false
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          max: 10,
          grid: {
            color: 'rgba(124,58,237,0.10)'
          },
          ticks: {
            color: '#8b5cf6',
            font: {
              weight: '800'
            }
          }
        },
        x: {
          grid: {
            display: false
          },
          ticks: {
            color: '#8b5cf6',
            font: {
              weight: '800'
            }
          }
        }
      }
    }
  });
}

function updateDailyScore() {
  const day = new Date().getDate() - 1;
  const completed = data.tasks.filter(task => task.done).length;
  const total = data.tasks.length || 1;
  const score = Math.round((completed / total) * 10);

  data.monthlyProgress[day] = score;
}

function completeTask(id) {
  data.tasks = data.tasks.map(task => {
    if (task.id === id) {
      return {
        ...task,
        done: true,
        status: 'completed'
      };
    }

    return task;
  });

  if (activeTaskId === id) {
    clearInterval(timerInterval);
    timerRunning = false;
    activeTaskId = null;
    remainingSeconds = 0;
    totalSeconds = 0;
    qs('#startTimerBtn').textContent = 'Start';
    updateTimerUI();
  }

  updateDailyScore();
  renderTasks();
}

function toggleTask(id) {
  const task = data.tasks.find(item => item.id === id);

  if (!task) return;

  if (task.done) {
    data.tasks = data.tasks.map(item => {
      if (item.id === id) {
        return {
          ...item,
          done: false,
          status: 'pending'
        };
      }

      return item;
    });
  } else {
    completeTask(id);
    return;
  }

  updateDailyScore();
  renderTasks();
}

function addTask() {
  const name = qs('#taskName').value.trim();
  const category = qs('#taskCategory').value;
  const startTime = qs('#taskStartTime').value;
  let endTime = qs('#taskEndTime').value;
  let duration = Number(qs('#taskDuration').value);

  if (!name) {
    alert('Please enter task name');
    return;
  }

  if (!startTime) {
    alert('Please select start time');
    return;
  }

  if (!endTime && !duration) {
    alert('Please enter end time or duration');
    return;
  }

  if (!duration && startTime && endTime) {
    duration = calculateDuration(startTime, endTime);
  }

  if (!endTime && startTime && duration) {
    endTime = addMinutesToTime(startTime, duration);
  }

  data.tasks.push({
    id: Date.now(),
    name,
    category,
    startTime,
    endTime,
    duration,
    done: false,
    status: 'pending',
    alertedDate: ''
  });

  qs('#taskName').value = '';
  qs('#taskStartTime').value = '';
  qs('#taskEndTime').value = '';
  qs('#taskDuration').value = '';

  renderTasks();
}

function addScheduleTask() {
  const name = qs('#scheduleTaskName').value.trim();
  const startTime = qs('#scheduleStartTime').value;
  let endTime = qs('#scheduleEndTime').value;
  let duration = Number(qs('#scheduleDuration').value);
  const category = qs('#scheduleTaskCategory').value;

  if (!name) {
    alert('Please enter task name');
    return;
  }

  if (!startTime) {
    alert('Please select start time');
    return;
  }

  if (!endTime && !duration) {
    alert('Please enter end time or duration');
    return;
  }

  if (!duration && startTime && endTime) {
    duration = calculateDuration(startTime, endTime);
  }

  if (!endTime && startTime && duration) {
    endTime = addMinutesToTime(startTime, duration);
  }

  data.tasks.push({
    id: Date.now(),
    name,
    category,
    startTime,
    endTime,
    duration,
    done: false,
    status: 'pending',
    alertedDate: ''
  });

  qs('#scheduleTaskName').value = '';
  qs('#scheduleStartTime').value = '';
  qs('#scheduleEndTime').value = '';
  qs('#scheduleDuration').value = '';

  renderTasks();
}

function addGoal() {
  const name = qs('#goalName').value.trim();
  const target = Number(qs('#goalTarget').value);
  const done = Number(qs('#goalDone').value || 0);

  if (!name || !target) {
    alert('Please enter goal name and target');
    return;
  }

  data.goals.push({
    id: Date.now(),
    name,
    target,
    done
  });

  qs('#goalName').value = '';
  qs('#goalTarget').value = '';
  qs('#goalDone').value = '';

  renderGoals();
}

function startTask(id) {
  const task = data.tasks.find(item => item.id === id);

  if (!task || task.done) return;

  clearInterval(timerInterval);

  activeTaskId = id;
  timerRunning = true;
  totalSeconds = Number(task.duration || 25) * 60;
  remainingSeconds = totalSeconds;

  data.tasks = data.tasks.map(item => ({
    ...item,
    status: item.id === id ? 'running' : item.done ? 'completed' : 'pending'
  }));

  qs('#startTimerBtn').textContent = 'Pause';

  updateTimerUI();
  updateActiveTimerText();
  renderTasks();

  timerInterval = setInterval(() => {
    remainingSeconds--;

    if (remainingSeconds <= 0) {
      clearInterval(timerInterval);
      timerRunning = false;
      qs('#startTimerBtn').textContent = 'Start';

      showAlarm({
        ...task,
        name: `${task.name} completed automatically`,
        category: task.category,
        startTime: task.startTime
      });

      completeTask(id);
      return;
    }

    updateTimerUI();
  }, 1000);
}

function startTimer() {
  if (!activeTaskId) {
    alert('Please start any task from Daily Tasks first.');
    switchTab('tasks');
    return;
  }

  if (timerRunning) {
    clearInterval(timerInterval);
    timerRunning = false;
    qs('#startTimerBtn').textContent = 'Resume';
    return;
  }

  timerRunning = true;
  qs('#startTimerBtn').textContent = 'Pause';

  timerInterval = setInterval(() => {
    remainingSeconds--;

    if (remainingSeconds <= 0) {
      clearInterval(timerInterval);
      timerRunning = false;
      qs('#startTimerBtn').textContent = 'Start';

      completeTask(activeTaskId);
      return;
    }

    updateTimerUI();
  }, 1000);
}

function resetTimer() {
  clearInterval(timerInterval);

  timerRunning = false;

  if (activeTaskId) {
    const task = data.tasks.find(item => item.id === activeTaskId);
    totalSeconds = Number(task?.duration || 25) * 60;
    remainingSeconds = totalSeconds;
  } else {
    totalSeconds = 0;
    remainingSeconds = 0;
  }

  qs('#startTimerBtn').textContent = 'Start';
  updateTimerUI();
}

function updateTimerUI() {
  const minutes = String(Math.floor(remainingSeconds / 60)).padStart(2, '0');
  const seconds = String(remainingSeconds % 60).padStart(2, '0');

  qs('#timerText').textContent = `${minutes}:${seconds}`;

  const progress = totalSeconds
    ? ((totalSeconds - remainingSeconds) / totalSeconds) * 100
    : 0;

  qs('#timerRing').style.setProperty('--timer-progress', `${progress}%`);
}

function switchTab(tabName) {
  qsa('.tab-section').forEach(section => {
    section.classList.add('hidden');
    section.classList.remove('fade-in');
  });

  const activeSection = qs(`#${tabName}`);

  if (!activeSection) return;

  activeSection.classList.remove('hidden');

  setTimeout(() => {
    activeSection.classList.add('fade-in');
  }, 10);

  qsa('.nav-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === tabName);
  });
}

function enableNotifications() {
  if (!('Notification' in window)) {
    alert('Your browser does not support notifications. In-app alarm will still work.');
    return;
  }

  Notification.requestPermission().then(permission => {
    if (permission === 'granted') {
      alert('Notifications enabled successfully 🔔');
    } else {
      alert('Notifications blocked. Browser popup alarm will still work while page is open.');
    }
  });
}

function playAlarmSound() {
  try {
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const oscillator = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();

    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(880, audioCtx.currentTime);
    oscillator.frequency.setValueAtTime(660, audioCtx.currentTime + 0.25);
    oscillator.frequency.setValueAtTime(880, audioCtx.currentTime + 0.5);

    gainNode.gain.setValueAtTime(0.001, audioCtx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.25, audioCtx.currentTime + 0.05);
    gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 1.2);

    oscillator.connect(gainNode);
    gainNode.connect(audioCtx.destination);

    oscillator.start();
    oscillator.stop(audioCtx.currentTime + 1.25);
  } catch (error) {
    console.log('Alarm sound blocked until user interacts with page.');
  }
}

function showAlarm(task) {
  qs('#alarmTitle').textContent = `⏰ ${formatTime(task.startTime)} Reminder`;
  qs('#alarmMessage').textContent = `Now start: ${task.name} (${task.category})`;
  qs('#alarmModal').classList.add('show');

  playAlarmSound();

  if ('Notification' in window && Notification.permission === 'granted') {
    new Notification('Study Tracker Reminder 🔔', {
      body: `Time for ${task.name}`,
      tag: `study-task-${task.id}-${getTodayString()}`
    });
  }
}

function closeAlarm() {
  qs('#alarmModal').classList.remove('show');
  switchTab('tasks');
}

function checkScheduledAlerts() {
  const now = new Date();
  const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  const today = getTodayString();

  data.tasks.forEach(task => {
    if (
      task.startTime === currentTime &&
      !task.done &&
      task.alertedDate !== today
    ) {
      task.alertedDate = today;
      showAlarm(task);
    }
  });

  saveData();
  updateNextAlarm();
}

function bindEvents() {
  qsa('.nav-btn').forEach(btn => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  });

  qs('#addTaskBtn').addEventListener('click', addTask);
  qs('#addGoalBtn').addEventListener('click', addGoal);
  qs('#addScheduleBtn').addEventListener('click', addScheduleTask);
  qs('#enableNotifyBtn').addEventListener('click', enableNotifications);
  qs('#closeAlarmBtn').addEventListener('click', closeAlarm);
  qs('#startTimerBtn').addEventListener('click', startTimer);
  qs('#resetTimerBtn').addEventListener('click', resetTimer);

  qs('#themeBtn').addEventListener('click', () => {
    document.body.classList.toggle('dark');

    qs('#themeBtn').textContent = document.body.classList.contains('dark')
      ? '☀️ Light'
      : '🌙 Dark';

    renderChart();
  });

  qs('#focusBtn').addEventListener('click', () => {
    switchTab('tasks');
    qs('#quoteText').textContent = 'Focus mode on: choose one task and finish only that.';
  });

  qs('#resetBtn').addEventListener('click', () => {
    if (!confirm('Reset demo data?')) return;

    localStorage.removeItem('studyTrackerData');
    data = JSON.parse(JSON.stringify(defaultData));

    activeTaskId = null;
    clearInterval(timerInterval);
    timerRunning = false;
    totalSeconds = 0;
    remainingSeconds = 0;

    init();
  });

  qs('#saveNotesBtn').addEventListener('click', () => {
    data.notes = qs('#notesBox').value;
    saveData();
    alert('Notes saved in browser localStorage');
  });

  qs('#datePicker').addEventListener('change', event => {
    data.selectedDate = event.target.value;
    saveData();
  });
}

function init() {
  setCurrentDate();
  setTodayTheme();
  updateTimerUI();

  qs('#notesBox').value = data.notes || '';

  renderTasks();
  renderGoals();
  renderSchedule();
  updateNextAlarm();
  updateActiveTimerText();
  checkScheduledAlerts();
}

document.addEventListener('DOMContentLoaded', () => {
  bindEvents();
  init();

  setInterval(checkScheduledAlerts, 30000);
});