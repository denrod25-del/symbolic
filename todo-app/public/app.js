// The frontend's only job is to (a) show data and (b) send the user's
// intent to the backend. All real state lives on the server.
//
// Every interaction follows the same loop:
//   1. user does something (clicks, types)
//   2. we call fetch() to tell the backend
//   3. the backend updates its data and responds with JSON
//   4. we re-render the UI from that JSON
//
// Read the network tab in your browser's devtools while you click around.
// You'll see the exact requests and responses described in server.cpp.

const API = '/api/todos';

const form = document.getElementById('new-todo-form');
const input = document.getElementById('new-todo-input');
const list = document.getElementById('todo-list');
const empty = document.getElementById('empty-state');
const errorBox = document.getElementById('error');

/**
 * Talks to the backend.
 *
 * fetch() returns a Promise that resolves once the response headers are in.
 * We then parse the body as JSON (unless the server sent 204 No Content,
 * which is what DELETE returns).
 */
async function api(path, options = {}) {
  const response = await fetch(path, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!response.ok) {
    throw new Error(`request failed: ${response.status}`);
  }
  if (response.status === 204) return null;
  return response.json();
}

function showError(message) {
  errorBox.textContent = message;
  errorBox.hidden = false;
  setTimeout(() => { errorBox.hidden = true; }, 3000);
}

function render(todos) {
  list.innerHTML = '';
  empty.hidden = todos.length > 0;

  for (const todo of todos) {
    const li = document.createElement('li');
    if (todo.done) li.classList.add('done');

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = todo.done;
    checkbox.addEventListener('change', () => toggle(todo));

    const text = document.createElement('span');
    text.className = 'text';
    text.textContent = todo.text;

    const deleteButton = document.createElement('button');
    deleteButton.type = 'button';
    deleteButton.textContent = 'Delete';
    deleteButton.addEventListener('click', () => remove(todo));

    li.append(checkbox, text, deleteButton);
    list.append(li);
  }
}

// GET /api/todos -> [{id, text, done}, ...]
async function load() {
  try {
    const todos = await api(API);
    render(todos);
  } catch (err) {
    showError('Could not load todos. Is the C++ server running?');
  }
}

// POST /api/todos with body {text}
async function create(text) {
  const created = await api(API, {
    method: 'POST',
    body: JSON.stringify({ text }),
  });
  // Append optimistically so the UI feels instant. We could also re-fetch
  // the whole list — both are common patterns.
  const current = [...list.querySelectorAll('li')].map(() => null);
  current.push(created);
  await load();
}

// PATCH /api/todos/:id with body {done}
async function toggle(todo) {
  await api(`${API}/${todo.id}`, {
    method: 'PATCH',
    body: JSON.stringify({ done: !todo.done }),
  });
  await load();
}

// DELETE /api/todos/:id
async function remove(todo) {
  await api(`${API}/${todo.id}`, { method: 'DELETE' });
  await load();
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  const text = input.value.trim();
  if (!text) return;
  input.value = '';
  try {
    await create(text);
  } catch (err) {
    showError('Could not save todo.');
  }
});

load();
