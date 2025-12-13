export default {
  async fetch(request, env, ctx) {
    // Add CORS headers to all responses
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };

    // Handle preflight requests
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: corsHeaders,
      });
    }

    const url = new URL(request.url);
    const pathname = url.pathname;

    // GET /api/todos - Retrieve all todo items
    if (pathname === '/api/todos' && request.method === 'GET') {
      try {
        const { results } = await env.DB.prepare(
          'SELECT id, title, description, completed, createdAt, completedAt FROM todos ORDER BY createdAt DESC'
        ).all();
        
        const todos = results.map(todo => ({
          id: todo.id,
          title: todo.title,
          description: todo.description,
          completed: todo.completed === 1,
          createdAt: todo.createdAt,
          completedAt: todo.completedAt,
        }));

        return new Response(JSON.stringify(todos), {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
            ...corsHeaders,
          },
        });
      } catch (error) {
        console.error('Error fetching todos:', error);
        return new Response(JSON.stringify({ error: 'Failed to fetch todos' }), {
          status: 500,
          headers: {
            'Content-Type': 'application/json',
            ...corsHeaders,
          },
        });
      }
    }

    // POST /api/todos - Create a new todo item
    if (pathname === '/api/todos' && request.method === 'POST') {
      try {
        const body = await request.json();
        
        if (!body.title || typeof body.title !== 'string' || body.title.trim() === '') {
          return new Response(JSON.stringify({ error: 'Title is required' }), {
            status: 400,
            headers: {
              'Content-Type': 'application/json',
              ...corsHeaders,
            },
          });
        }

        const title = body.title.trim();
        const description = body.description ? body.description.trim() : null;
        const now = new Date().toISOString();

        const info = await env.DB.prepare(
          'INSERT INTO todos (title, description, completed, createdAt, completedAt) VALUES (?, ?, 0, ?, NULL)'
        ).bind(title, description, now).run();

        const { results } = await env.DB.prepare(
          'SELECT id, title, description, completed, createdAt, completedAt FROM todos WHERE id = ?'
        ).bind(info.meta.last_row_id).all();

        if (results.length === 0) {
          return new Response(JSON.stringify({ error: 'Failed to create todo' }), {
            status: 500,
            headers: {
              'Content-Type': 'application/json',
              ...corsHeaders,
            },
          });
        }

        const todo = results[0];
        return new Response(JSON.stringify({
          id: todo.id,
          title: todo.title,
          description: todo.description,
          completed: todo.completed === 1,
          createdAt: todo.createdAt,
          completedAt: todo.completedAt,
        }), {
          status: 201,
          headers: {
            'Content-Type': 'application/json',
            ...corsHeaders,
          },
        });
      } catch (error) {
        console.error('Error creating todo:', error);
        return new Response(JSON.stringify({ error: 'Failed to create todo' }), {
          status: 500,
          headers: {
            'Content-Type': 'application/json',
            ...corsHeaders,
          },
        });
      }
    }

    // PUT /api/todos/:id - Update a todo item
    if (pathname.match(/^\/api\/todos\/\d+$/) && request.method === 'PUT') {
      try {
        const id = parseInt(pathname.split('/')[3]);
        const body = await request.json();

        // Check if todo exists
        const { results: existingTodos } = await env.DB.prepare(
          'SELECT id FROM todos WHERE id = ?'
        ).bind(id).all();

        if (existingTodos.length === 0) {
          return new Response(JSON.stringify({ error: 'Todo not found' }), {
            status: 404,
            headers: {
              'Content-Type': 'application/json',
              ...corsHeaders,
            },
          });
        }

        // Update todo
        const updateFields = [];
        const bindValues = [];

        if ('title' in body && body.title !== undefined) {
          updateFields.push('title = ?');
          bindValues.push(body.title.trim());
        }

        if ('description' in body && body.description !== undefined) {
          updateFields.push('description = ?');
          bindValues.push(body.description.trim());
        }

        if ('completed' in body && body.completed !== undefined) {
          updateFields.push('completed = ?');
          bindValues.push(body.completed ? 1 : 0);
          
          if (body.completed) {
            updateFields.push('completedAt = ?');
            bindValues.push(new Date().toISOString());
          } else {
            updateFields.push('completedAt = ?');
            bindValues.push(null);
          }
        }

        if (updateFields.length === 0) {
          return new Response(JSON.stringify({ error: 'No fields to update' }), {
            status: 400,
            headers: {
              'Content-Type': 'application/json',
              ...corsHeaders,
            },
          });
        }

        bindValues.push(id);
        const query = `UPDATE todos SET ${updateFields.join(', ')} WHERE id = ?`;
        
        await env.DB.prepare(query).bind(...bindValues).run();

        // Fetch updated todo
        const { results } = await env.DB.prepare(
          'SELECT id, title, description, completed, createdAt, completedAt FROM todos WHERE id = ?'
        ).bind(id).all();

        const todo = results[0];
        return new Response(JSON.stringify({
          id: todo.id,
          title: todo.title,
          description: todo.description,
          completed: todo.completed === 1,
          createdAt: todo.createdAt,
          completedAt: todo.completedAt,
        }), {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
            ...corsHeaders,
          },
        });
      } catch (error) {
        console.error('Error updating todo:', error);
        return new Response(JSON.stringify({ error: 'Failed to update todo' }), {
          status: 500,
          headers: {
            'Content-Type': 'application/json',
            ...corsHeaders,
          },
        });
      }
    }

    // DELETE /api/todos/:id - Delete a todo item
    if (pathname.match(/^\/api\/todos\/\d+$/) && request.method === 'DELETE') {
      try {
        const id = parseInt(pathname.split('/')[3]);

        // Check if todo exists
        const { results: existingTodos } = await env.DB.prepare(
          'SELECT id FROM todos WHERE id = ?'
        ).bind(id).all();

        if (existingTodos.length === 0) {
          return new Response(JSON.stringify({ error: 'Todo not found' }), {
            status: 404,
            headers: {
              'Content-Type': 'application/json',
              ...corsHeaders,
            },
          });
        }

        // Delete todo
        await env.DB.prepare('DELETE FROM todos WHERE id = ?').bind(id).run();

        return new Response(JSON.stringify({ message: 'Todo deleted successfully' }), {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
            ...corsHeaders,
          },
        });
      } catch (error) {
        console.error('Error deleting todo:', error);
        return new Response(JSON.stringify({ error: 'Failed to delete todo' }), {
          status: 500,
          headers: {
            'Content-Type': 'application/json',
            ...corsHeaders,
          },
        });
      }
    }

    // 404 for unmatched routes
    return new Response(JSON.stringify({ error: 'Not found' }), {
      status: 404,
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders,
      },
    });
  },
};