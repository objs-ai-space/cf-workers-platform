CREATE TABLE todos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  description TEXT,
  completed INTEGER DEFAULT 0,
  createdAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  completedAt TEXT
);

CREATE INDEX idx_todos_completed ON todos(completed);

CREATE INDEX idx_todos_createdAt ON todos(createdAt);

INSERT INTO todos (title, description, completed, createdAt, completedAt) VALUES ('Buy groceries', 'Milk, eggs, bread, and vegetables', 1, '2024-01-15 08:30:00', '2024-01-15 14:45:00');

INSERT INTO todos (title, description, completed, createdAt, completedAt) VALUES ('Finish project report', 'Complete Q1 financial analysis and submit to manager', 1, '2024-01-10 09:00:00', '2024-01-12 16:20:00');

INSERT INTO todos (title, description, completed, createdAt, completedAt) VALUES ('Call dentist', 'Schedule appointment for teeth cleaning', 0, '2024-01-18 10:15:00', NULL);

INSERT INTO todos (title, description, completed, createdAt, completedAt) VALUES ('Exercise', 'Run 5km in the morning', 0, '2024-01-18 07:00:00', NULL);

INSERT INTO todos (title, description, completed, createdAt, completedAt) VALUES ('Read book', 'Finish reading chapter 5 of The Pragmatic Programmer', 1, '2024-01-08 20:30:00', '2024-01-16 21:15:00');

INSERT INTO todos (title, description, completed, createdAt, completedAt) VALUES ('Pay bills', 'Electricity, water, and internet bills due on the 20th', 0, '2024-01-17 11:00:00', NULL);

INSERT INTO todos (title, description, completed, createdAt, completedAt) VALUES ('Learn SQLite', 'Complete the database tutorial and practice queries', 0, '2024-01-16 14:30:00', NULL);

INSERT INTO todos (title, description, completed, createdAt, completedAt) VALUES ('Clean apartment', 'Vacuum living room, mop kitchen, organize bedroom', 1, '2024-01-12 08:00:00', '2024-01-13 17:30:00');

INSERT INTO todos (title, description, completed, createdAt, completedAt) VALUES ('Review pull requests', 'Check and approve pending code reviews on GitHub', 0, '2024-01-18 09:45:00', NULL);

INSERT INTO todos (title, description, completed, createdAt, completedAt) VALUES ('Plan vacation', 'Research flights and hotels for summer trip to Italy', 0, '2024-01-17 19:20:00', NULL);