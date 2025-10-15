const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
const spotsPerDay = 6;
const STORAGE_KEYS = {
  employees: "parknet_employees",
  baseline: "parknet_baseline",
  absences: "parknet_absences"
};

let employees = [];
let baselineSpots = {};
let absences = {};

function isoDate(d) {
  return new Date(d.getTime() - d.getTimezoneOffset()*60000).toISOString().slice(0, 10);
}
function getCurrentWeekDates() {
  const today = new Date();
  const dow = today.getDay();
  const mondayOffset = (dow + 6) % 7;
  const monday = new Date(today);
  monday.setDate(today.getDate() - mondayOffset);
  const map = {};
  days.forEach((dayName, idx) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + idx);
    map[dayName] = { iso: isoDate(d), label: d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) };
  });
  return map;
}
function purgeExpiredAbsences() {
  const todayISO = isoDate(new Date());
  const updated = {};
  for (const date in absences) {
    if (date >= todayISO) updated[date] = absences[date];
  }
  absences = updated;
}

function saveState() {
  localStorage.setItem(STORAGE_KEYS.employees, JSON.stringify(employees));
  localStorage.setItem(STORAGE_KEYS.baseline, JSON.stringify(baselineSpots));
  localStorage.setItem(STORAGE_KEYS.absences, JSON.stringify(absences));
}
function loadState() {
  employees = JSON.parse(localStorage.getItem(STORAGE_KEYS.employees)) || ["Alice Johnson", "Bob Smith", "Charlie Nguyen"];
  baselineSpots = JSON.parse(localStorage.getItem(STORAGE_KEYS.baseline)) || {};
  if (Object.keys(baselineSpots).length === 0) {
    days.forEach(day => baselineSpots[day] = Array(spotsPerDay).fill(null));
  }
  absences = JSON.parse(localStorage.getItem(STORAGE_KEYS.absences)) || {};
  purgeExpiredAbsences();
}

const getSortedEmployees = () => [...employees].sort((a, b) => a.localeCompare(b));

function findEmployeeSpotIndexBaseline(day, employee) {
  return baselineSpots[day].findIndex(name => name === employee);
}
function assignEmployeeToDayBaseline(employee, day) {
  if (findEmployeeSpotIndexBaseline(day, employee) !== -1) return true;
  const freeIndex = baselineSpots[day].findIndex(s => s === null);
  if (freeIndex === -1) return false;
  baselineSpots[day][freeIndex] = employee;
  saveState();
  return true;
}
function removeEmployeeFromDayBaseline(employee, day) {
  const idx = findEmployeeSpotIndexBaseline(day, employee);
  if (idx !== -1) {
    baselineSpots[day][idx] = null;
    saveState();
    return true;
  }
  return false;
}

function isAbsentOnDate(employee, dateISO) {
  return Array.isArray(absences[dateISO]) && absences[dateISO].includes(employee);
}
function addAbsenceForDay(employee, day) {
  const weekDates = getCurrentWeekDates();
  const dateISO = weekDates[day].iso;
  if (!absences[dateISO]) absences[dateISO] = [];
  if (!absences[dateISO].includes(employee)) {
    absences[dateISO].push(employee);
    saveState();
  }
}

function getEffectiveSpotsForCurrentWeek() {
  const weekDates = getCurrentWeekDates();
  const effective = {};
  days.forEach(day => {
    effective[day] = baselineSpots[day].map(name => {
      if (!name) return null;
      const dateISO = weekDates[day].iso;
      return isAbsentOnDate(name, dateISO) ? null : name;
    });
  });
  return effective;
}

/*********** Rendering ***********/
function renderGrid() {
  const grid = document.getElementById('parkingGrid');
  grid.innerHTML = '';
  const effective = getEffectiveSpotsForCurrentWeek();
  const weekDates = getCurrentWeekDates();

  days.forEach(day => {
    const col = document.createElement('div');
    col.className = 'day-column';
    col.innerHTML = `<h3>${day}</h3><div class="day-date">${weekDates[day].label}</div>`;

    effective[day].forEach((spotName, index) => {
      const spotDiv = document.createElement('div');
      spotDiv.className = 'spot ' + (spotName ? 'reserved' : 'free');

      if (spotName) {
        spotDiv.innerHTML = `
          <span><strong>${spotName}</strong></span><br/>
          <button class="free-btn" onclick="markAbsence('${spotName}', '${day}')">Free Spot</button>
        `;
      } else {
        spotDiv.innerHTML = `
          <span>Free</span><br/>
          <button class="reserve-btn" onclick="reserveSpot('${day}', ${index})">Reserve</button>
        `;
      }
      col.appendChild(spotDiv);
    });
    grid.appendChild(col);
  });
}

function reserveSpot(day, index) {
  const name = prompt("Enter your name:");
  if (!name || !employees.includes(name)) {
    alert("Name not found in employee list.");
    return;
  }
  const effective = getEffectiveSpotsForCurrentWeek();
  if (effective[day][index] === null) {
    baselineSpots[day][index] = name;
    saveState();
    renderGrid();
    renderAdminSection();
  }
}

function markAbsence(employee, day) {
  addAbsenceForDay(employee, day);
  renderGrid();
  renderAdminSection();
}

/*********** Admin ***********/
function addEmployee() {
  const input = document.getElementById('newEmployeeName');
  const name = input.value.trim();
  if (!name) return alert("Enter a valid name");
  if (employees.includes(name)) return alert("Employee already exists");
  employees.push(name);
  input.value = '';
  saveState();
  renderGrid();
  renderAdminSection();
}

function removeEmployee(employee) {
  days.forEach(day => {
    baselineSpots[day] = baselineSpots[day].map(n => n === employee ? null : n);
  });
  employees = employees.filter(e => e !== employee);
  saveState();
  renderGrid();
  renderAdminSection();
}

function handleEmployeeDayToggle(employee, day, checked) {
  if (checked) {
    const ok = assignEmployeeToDayBaseline(employee, day);
    if (!ok) alert(`No free spots left on ${day}`);
  } else {
    removeEmployeeFromDayBaseline(employee, day);
  }
  renderGrid();
  renderAdminSection();
}

function renderAdminSection() {
  const container = document.getElementById('adminEmployees');
  container.innerHTML = '';
  const table = document.createElement('table');
  table.className = 'admin-table';

  const thead = document.createElement('thead');
  const hr = document.createElement('tr');
  hr.innerHTML = `<th>Employee</th>${days.map(d => `<th>${d}</th>`).join('')}<th>Action</th>`;
  thead.appendChild(hr);
  table.appendChild(thead);

  const tbody = document.createElement('tbody');
  getSortedEmployees().forEach(emp => {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td class="emp-name">${emp}</td>`;
    days.forEach(day => {
      const td = document.createElement('td');
      const cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.checked = baselineSpots[day].includes(emp);
      cb.addEventListener('change', e => handleEmployeeDayToggle(emp, day, e.target.checked));
      td.appendChild(cb);
      tr.appendChild(td);
    });
    const tdDel = document.createElement('td');
    const btn = document.createElement('button');
    btn.textContent = 'Remove';
    btn.className = 'remove-btn';
    btn.onclick = () => removeEmployee(emp);
    tdDel.appendChild(btn);
    tr.appendChild(tdDel);
    tbody.appendChild(tr);
  });

  // Totals row
  const effective = getEffectiveSpotsForCurrentWeek();
  const totalsRow = document.createElement('tr');
  totalsRow.innerHTML = `<td><strong>Totals</strong></td>` +
    days.map(day => {
      const booked = effective[day].filter(s => s).length;
      const left = spotsPerDay - booked;
      return `<td><strong>${booked}</strong> booked<br>${left} left</td>`;
    }).join('') + `<td></td>`;
  tbody.appendChild(totalsRow);

  table.appendChild(tbody);
  container.appendChild(table);

  document.getElementById('addEmployeeBtn').onclick = addEmployee;
}

/*********** Init ***********/
function init() {
  loadState();
  saveState();
  renderGrid();
  renderAdminSection();
}
window.reserveSpot = reserveSpot;
window.markAbsence = markAbsence;
init();