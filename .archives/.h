<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Simple Todo App</title>
    <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
    <style>
        :root {
            --bg-primary: #0a0e27;
            --bg-secondary: #13172f;
            --bg-tertiary: #1a1f3a;
            --accent-primary: #6366f1;
            --accent-secondary: #ec4899;
            --accent-tertiary: #14b8a6;
            --text-primary: #f1f5f9;
            --text-secondary: #cbd5e1;
            --text-tertiary: #94a3b8;
            --border-color: #334155;
            --success-color: #10b981;
            --danger-color: #ef4444;
            --shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.3);
            --shadow-md: 0 4px 6px rgba(0, 0, 0, 0.4);
            --shadow-lg: 0 10px 25px rgba(0, 0, 0, 0.5);
        }

        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        html, body {
            width: 100%;
            height: 100%;
        }

        body {
            font-family: 'Poppins', sans-serif;
            background: linear-gradient(135deg, var(--bg-primary) 0%, var(--bg-secondary) 100%);
            color: var(--text-primary);
            overflow-x: hidden;
        }

        #app {
            display: flex;
            flex-direction: column;
            min-height: 100vh;
        }

        header {
            background: linear-gradient(90deg, rgba(99, 102, 241, 0.1) 0%, rgba(236, 72, 153, 0.1) 100%);
            border-bottom: 1px solid var(--border-color);
            padding: 1.5rem 1rem;
            position: sticky;
            top: 0;
            z-index: 100;
            backdrop-filter: blur(10px);
        }

        .header-content {
            max-width: 800px;
            margin: 0 auto;
            display: flex;
            align-items: center;
            justify-content: space-between;
        }

        .header-title {
            display: flex;
            align-items: center;
            gap: 0.75rem;
            font-size: 1.5rem;
            font-weight: 700;
            background: linear-gradient(135deg, var(--accent-primary) 0%, var(--accent-secondary) 100%);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            background-clip: text;
        }

        .header-title svg {
            width: 32px;
            height: 32px;
            filter: drop-shadow(0 0 8px rgba(99, 102, 241, 0.5));
        }

        .stats-bar {
            display: flex;
            gap: 1.5rem;
            font-size: 0.875rem;
        }

        .stat-item {
            display: flex;
            align-items: center;
            gap: 0.5rem;
            color: var(--text-secondary);
        }

        .stat-number {
            font-weight: 600;
            color: var(--accent-primary);
        }

        main {
            flex: 1;
            max-width: 800px;
            width: 100%;
            margin: 0 auto;
            padding: 2rem 1rem;
        }

        .todo-section {
            display: flex;
            flex-direction: column;
            gap: 2rem;
        }

        .input-form {
            background: var(--bg-secondary);
            border: 1px solid var(--border-color);
            border-radius: 12px;
            padding: 1.5rem;
            backdrop-filter: blur(10px);
            box-shadow: var(--shadow-md);
            transition: all 0.3s ease;
        }

        .input-form:focus-within {
            border-color: var(--accent-primary);
            box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.1), var(--shadow-md);
        }

        .form-group {
            display: flex;
            flex-direction: column;
            gap: 0.75rem;
            margin-bottom: 1rem;
        }

        .form-group:last-child {
            margin-bottom: 0;
        }

        label {
            font-size: 0.875rem;
            font-weight: 500;
            color: var(--text-secondary);
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }

        input[type="text"],
        textarea {
            background: var(--bg-tertiary);
            border: 1px solid var(--border-color);
            border-radius: 8px;
            padding: 0.75rem 1rem;
            color: var(--text-primary);
            font-family: 'Poppins', sans-serif;
            font-size: 1rem;
            transition: all 0.2s ease;
        }

        input[type="text"]:focus,
        textarea:focus {
            outline: none;
            border-color: var(--accent-primary);
            background: rgba(99, 102, 241, 0.05);
            box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.1);
        }

        textarea {
            resize: vertical;
            min-height: 80px;
            font-size: 0.95rem;
        }

        .form-buttons {
            display: flex;
            gap: 0.75rem;
            justify-content: flex-end;
        }

        button {
            font-family: 'Poppins', sans-serif;
            font-weight: 500;
            border: none;
            border-radius: 8px;
            padding: 0.75rem 1.5rem;
            cursor: pointer;
            transition: all 0.2s ease;
            font-size: 0.95rem;
        }

        .btn-primary {
            background: linear-gradient(135deg, var(--accent-primary) 0%, var(--accent-secondary) 100%);
            color: white;
            box-shadow: var(--shadow-md);
        }

        .btn-primary:hover:not(:disabled) {
            transform: translateY(-2px);
            box-shadow: 0 8px 16px rgba(99, 102, 241, 0.3);
        }

        .btn-primary:active:not(:disabled) {
            transform: translateY(0);
        }

        .btn-primary:disabled {
            opacity: 0.5;
            cursor: not-allowed;
        }

        .btn-secondary {
            background: var(--bg-tertiary);
            color: var(--text-secondary);
            border: 1px solid var(--border-color);
        }

        .btn-secondary:hover:not(:disabled) {
            background: var(--accent-tertiary);
            color: var(--bg-primary);
            border-color: var(--accent-tertiary);
        }

        .btn-danger {
            background: var(--danger-color);
            color: white;
            padding: 0.5rem 1rem;
            font-size: 0.85rem;
        }

        .btn-danger:hover:not(:disabled) {
            background: #dc2626;
            transform: scale(1.05);
        }

        .btn-success {
            background: var(--success-color);
            color: white;
            padding: 0.5rem 1rem;
            font-size: 0.85rem;
        }

        .btn-success:hover:not(:disabled) {
            background: #059669;
            transform: scale(1.05);
        }

        .todo-list {
            display: flex;
            flex-direction: column;
            gap: 0.75rem;
        }

        .todo-item {
            background: var(--bg-secondary);
            border: 1px solid var(--border-color);
            border-radius: 10px;
            padding: 1.25rem;
            display: flex;
            align-items: flex-start;
            gap: 1rem;
            transition: all 0.3s ease;
            position: relative;
            overflow: hidden;
        }

        .todo-item::before {
            content: '';
            position: absolute;
            left: 0;
            top: 0;
            bottom: 0;
            width: 3px;
            background: linear-gradient(180deg, var(--accent-primary) 0%, var(--accent-secondary) 100%);
            opacity: 0;
            transition: opacity 0.3s ease;
        }

        .todo-item:hover {
            border-color: var(--accent-primary);
            box-shadow: 0 0 0 1px rgba(99, 102, 241, 0.2), var(--shadow-md);
            background: rgba(99, 102, 241, 0.05);
        }

        .todo-item:hover::before {
            opacity: 1;
        }

        .todo-item.completed {
            opacity: 0.6;
            background: rgba(16, 185, 129, 0.05);
        }

        .todo-item.completed .todo-title {
            text-decoration: line-through;
            color: var(--text-tertiary);
        }

        .checkbox-wrapper {
            position: relative;
            flex-shrink: 0;
        }

        input[type="checkbox"] {
            appearance: none;
            width: 24px;
            height: 24px;
            border: 2px solid var(--accent-primary);
            border-radius: 6px;
            cursor: pointer;
            transition: all 0.2s ease;
            background: transparent;
            display: flex;
            align-items: center;
            justify-content: center;
            margin-top: 2px;
        }

        input[type="checkbox"]:checked {
            background: linear-gradient(135deg, var(--accent-primary) 0%, var(--accent-secondary) 100%);
            border-color: var(--accent-primary);
        }

        input[type="checkbox"]:checked::after {
            content: '✓';
            color: white;
            font-size: 14px;
            font-weight: bold;
        }

        input[type="checkbox"]:hover {
            box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.2);
        }

        .todo-content {
            flex: 1;
            min-width: 0;
        }

        .todo-title {
            font-weight: 600;
            font-size: 1rem;
            color: var(--text-primary);
            word-break: break-word;
            margin-bottom: 0.25rem;
        }

        .todo-description {
            font-size: 0.875rem;
            color: var(--text-secondary);
            word-break: break-word;
        }

        .todo-meta {
            display: flex;
            align-items: center;
            gap: 0.75rem;
            font-size: 0.75rem;
            color: var(--text-tertiary);
            margin-top: 0.5rem;
        }

        .todo-actions {
            display: flex;
            gap: 0.5rem;
            flex-shrink: 0;
        }

        .empty-state {
            text-align: center;
            padding: 3rem 1rem;
            color: var(--text-tertiary);
        }

        .empty-state-icon {
            font-size: 3rem;
            margin-bottom: 1rem;
            opacity: 0.5;
        }

        .empty-state-title {
            font-size: 1.25rem;
            font-weight: 600;
            color: var(--text-secondary);
            margin-bottom: 0.5rem;
        }

        .empty-state-text {
            font-size: 0.95rem;
        }

        .loading {
            display: flex;
            justify-content: center;
            align-items: center;
            padding: 2rem;
            gap: 0.5rem;
        }

        .loading-spinner {
            width: 20px;
            height: 20px;
            border: 2px solid rgba(99, 102, 241, 0.2);
            border-top-color: var(--accent-primary);
            border-radius: 50%;
            animation: spin 0.6s linear infinite;
        }

        @keyframes spin {
            to { transform: rotate(360deg); }
        }

        .error-message {
            background: rgba(239, 68, 68, 0.1);
            border: 1px solid var(--danger-color);
            border-radius: 8px;
            padding: 1rem;
            color: #fca5a5;
            font-size: 0.95rem;
            margin-bottom: 1rem;
        }

        .error-message button {
            float: right;
            background: none;
            border: none;
            color: #fca5a5;
            cursor: pointer;
            font-size: 1.2rem;
            padding: 0;
        }

        footer {
            background: var(--bg-tertiary);
            border-top: 1px solid var(--border-color);
            padding: 1.5rem 1rem;
            text-align: center;
            color: var(--text-tertiary);
            font-size: 0.875rem;
            margin-top: auto;
        }

        @media (max-width: 640px) {
            main {
                padding: 1rem;
            }

            header {
                padding: 1rem;
            }

            .header-content {
                flex-direction: column;
                gap: 1rem;
                text-align: center;
            }

            .header-title {
                font-size: 1.25rem;
            }

            .stats-bar {
                width: 100%;
                justify-content: center;
            }

            .form-buttons {
                flex-direction: column;
            }

            button {
                width: 100%;
            }

            .todo-item {
                flex-wrap: wrap;
            }

            .todo-actions {
                width: 100%;
                margin-top: 0.75rem;
                justify-content: flex-end;
            }
        }

        @media (prefers-reduced-motion: reduce) {
            * {
                animation-duration: 0.01ms !important;
                animation-iteration-count: 1 !important;
                transition-duration: 0.01ms !important;
            }
        }
    </style>
</head>
<body>
    <div id="app">
        <header>
            <div class="header-content">
                <h1 class="header-title">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M9 11l3 3L22 4"></path>
                        <path d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                    </svg>
                    Todo App
                </h1>
                <div class="stats-bar">
                    <div class="stat-item">
                        <span>Total:</span>
                        <span class="stat-number" id="stat-total">0</span>
                    </div>
                    <div class="stat-item">
                        <span>Completed:</span>
                        <span class="stat-number" id="stat-completed">0</span>
                    </div>
                    <div class="stat-item">
                        <span>Remaining:</span>
                        <span class="stat-number" id="stat-remaining">0</span>
                    </div>
                </div>
            </div>
        </header>

        <main>
            <div id="error-container"></div>

            <section class="todo-section">
                <form class="input-form" id="todo-form">
                    <div class="form-group">
                        <label for="todo-title">Task Title</label>
                        <input 
                            type="text" 
                            id="todo-title" 
                            placeholder="What needs to be done?" 
                            required
                            autocomplete="off"
                        >
                    </div>
                    <div class="form-group">
                        <label for="todo-description">Description (Optional)</label>
                        <textarea 
                            id="todo-description" 
                            placeholder="Add more details about this task..."
                            autocomplete="off"
                        ></textarea>
                    </div>
                    <div class="form-buttons">
                        <button type="reset" class="btn-secondary">Clear</button>
                        <button type="submit" class="btn-primary" id="submit-btn">Add Task</button>
                    </div>
                </form>

                <div class="todo-list" id="todo-list">
                    <div class="loading">
                        <div class="loading-spinner"></div>
                        <span>Loading your tasks...</span>
                    </div>
                </div>
            </section>
        </main>

        <footer>
            <p>Simple Todo App • Keep track of your daily tasks</p>
        </footer>
    </div>

    <script>
        const API_BASE = 'https://platform-dispatcher.embitious.workers.dev/simple-todo-app';

        // DOM Elements
        const todoForm = document.getElementById('todo-form');
        const todoTitleInput = document.getElementById('todo-title');
        const todoDescriptionInput = document.getElementById('todo-description');
        const todoList = document.getElementById('todo-list');
        const submitBtn = document.getElementById('submit-btn');
        const errorContainer = document.getElementById('error-container');
        const statTotal = document.getElementById('stat-total');
        const statCompleted = document.getElementById('stat-completed');
        const statRemaining = document.getElementById('stat-remaining');

        let todos = [];

        // Initialize app
        async function init() {
            await loadTodos();
        }

        // Load all todos from API
        async function loadTodos() {
            try {
                clearError();
                todoList.innerHTML = '<div class="loading"><div class="loading-spinner"></div><span>Loading your tasks...</span></div>';

                const response = await fetch(`${API_BASE}/api/todos`);
                if (!response.ok) throw new Error('Failed to load todos');

                todos = await response.json();
                renderTodos();
                updateStats();
            } catch (error) {
                showError('Failed to load todos. Please try again.');
                console.error('Error loading todos:', error);
                todoList.innerHTML = '<div class="empty-state"><div class="empty-state-icon">⚠️</div><div class="empty-state-title">Unable to Load Tasks</div><div class="empty-state-text">Please check your connection and try again.</div></div>';
            }
        }

        // Render todos to the DOM
        function renderTodos() {
            if (todos.length === 0) {
                todoList.innerHTML = '<div class="empty-state"><div class="empty-state-icon">📝</div><div class="empty-state-title">No Tasks Yet</div><div class="empty-state-text">Create your first task to get started!</div></div>';
                return;
            }

            todoList.innerHTML = todos.map(todo => `
                <div class="todo-item ${todo.completed ? 'completed' : ''}">
                    <div class="checkbox-wrapper">
                        <input 
                            type="checkbox" 
                            ${todo.completed ? 'checked' : ''} 
                            onchange="toggleTodo(${todo.id})"
                            aria-label="Complete task"
                        >
                    </div>
                    <div class="todo-content">
                        <div class="todo-title">${escapeHtml(todo.title)}</div>
                        ${todo.description ? `<div class="todo-description">${escapeHtml(todo.description)}</div>` : ''}
                        <div class="todo-meta">
                            <span>Created ${formatDate(todo.createdAt)}</span>
                            ${todo.completedAt ? `<span>• Completed ${formatDate(todo.completedAt)}</span>` : ''}
                        </div>
                    </div>
                    <div class="todo-actions">
                        <button class="btn-danger" onclick="deleteTodo(${todo.id})" title="Delete task">Delete</button>
                    </div>
                </div>
            `).join('');
        }

        // Add new todo
        async function addTodo(e) {
            e.preventDefault();
            const title = todoTitleInput.value.trim();
            const description = todoDescriptionInput.value.trim();

            if (!title) {
                showError('Please enter a task title');
                return;
            }

            try {
                submitBtn.disabled = true;
                submitBtn.textContent = 'Adding...';
                clearError();

                const response = await fetch(`${API_BASE}/api/todos`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ title, description: description || null })
                });

                if (!response.ok) {
                    const error = await response.json();
                    throw new Error(error.error || 'Failed to add todo');
                }

                const newTodo = await response.json();
                todos.unshift(newTodo);
                renderTodos();
                updateStats();
                todoForm.reset();
                todoTitleInput.focus();
            } catch (error) {
                showError(error.message || 'Failed to add task');
                console.error('Error adding todo:', error);
            } finally {
                submitBtn.disabled = false;
                submitBtn.textContent = 'Add Task';
            }
        }

        // Toggle todo completion
        async function toggleTodo(id) {
            const todo = todos.find(t => t.id === id);
            if (!todo) return;

            try {
                clearError();
                const response = await fetch(`${API_BASE}/api/todos/${id}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ completed: !todo.completed })
                });

                if (!response.ok) throw new Error('Failed to update todo');

                const updatedTodo = await response.json();
                Object.assign(todo, updatedTodo);
                renderTodos();
                updateStats();
            } catch (error) {
                showError('Failed to update task');
                console.error('Error toggling todo:', error);
                renderTodos();
            }
        }

        // Delete todo
        async function deleteTodo(id) {
            if (!confirm('Are you sure you want to delete this task?')) return;

            try {
                clearError();
                const response = await fetch(`${API_BASE}/api/todos/${id}`, {
                    method: 'DELETE'
                });

                if (!response.ok) throw new Error('Failed to delete todo');

                todos = todos.filter(t => t.id !== id);
                renderTodos();
                updateStats();
            } catch (error) {
                showError('Failed to delete task');
                console.error('Error deleting todo:', error);
            }
        }

        // Update statistics
        function updateStats() {
            const total = todos.length;
            const completed = todos.filter(t => t.completed).length;
            const remaining = total - completed;

            statTotal.textContent = total;
            statCompleted.textContent = completed;
            statRemaining.textContent = remaining;
        }

        // Show error message
        function showError(message) {
            errorContainer.innerHTML = `
                <div class="error-message">
                    ${escapeHtml(message)}
                    <button onclick="this.parentElement.remove()" type="button">×</button>
                </div>
            `;
        }

        // Clear error message
        function clearError() {
            errorContainer.innerHTML = '';
        }

        // Utility functions
        function escapeHtml(text) {
            const div = document.createElement('div');
            div.textContent = text;
            return div.innerHTML;
        }

        function formatDate(dateString) {
            const date = new Date(dateString);
            const now = new Date();
            const diff = now - date;
            const minutes = Math.floor(diff / 60000);
            const hours = Math.floor(diff / 3600000);
            const days = Math.floor(diff / 86400000);

            if (minutes < 1) return 'just now';
            if (minutes < 60) return `${minutes}m ago`;
            if (hours < 24) return `${hours}h ago`;
            if (days < 7) return `${days}d ago`;

            return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        }

        // Event listeners
        todoForm.addEventListener('submit', addTodo);

        // Initialize app on load
        document.addEventListener('DOMContentLoaded', init);
    </script>
</body>
</html>