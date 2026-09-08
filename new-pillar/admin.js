(function () {
  'use strict';

  /* ---------- helpers ---------- */
  function $(sel, root) { return (root || document).querySelector(sel); }
  function $all(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
  function esc(s) {
    return String(s || '').replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function toast(msg, isError) {
    var el = $('#toast');
    el.textContent = msg;
    el.classList.toggle('error', !!isError);
    el.hidden = false;
    clearTimeout(toast._t);
    toast._t = setTimeout(function () { el.hidden = true; }, 3200);
  }

  async function api(path, opts) {
    opts = opts || {};
    var res = await fetch(path, Object.assign({ credentials: 'include' }, opts, {
      headers: Object.assign({ 'Content-Type': 'application/json' }, opts.headers || {}),
    }));
    if (res.status === 401) {
      showLogin();
      throw new Error('Session expired, please log in again');
    }
    var body = null;
    try { body = await res.json(); } catch (e) {}
    if (!res.ok) throw new Error((body && body.error) || 'Request failed');
    return body;
  }

  function fileToBase64(file) {
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.onload = function () { resolve(reader.result); };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  async function uploadFile(file) {
    var dataBase64 = await fileToBase64(file);
    var result = await api('/api/upload', {
      method: 'POST',
      body: JSON.stringify({ filename: file.name, dataBase64: dataBase64, contentType: file.type }),
    });
    return result.url;
  }

  /* ---------- auth ---------- */
  function showLogin() {
    $('#login-screen').hidden = false;
    $('#app').hidden = true;
  }
  function showApp() {
    $('#login-screen').hidden = true;
    $('#app').hidden = false;
  }

  async function checkSession() {
    try {
      var r = await fetch('/api/me', { credentials: 'include' });
      var body = await r.json();
      if (body && body.authenticated) {
        showApp();
        initAppData();
      } else {
        showLogin();
      }
    } catch (e) {
      showLogin();
    }
  }

  $('#login-form').addEventListener('submit', async function (e) {
    e.preventDefault();
    var username = $('#login-username').value.trim();
    var password = $('#login-password').value;
    var errEl = $('#login-error');
    errEl.hidden = true;
    var btn = $('#login-btn');
    btn.disabled = true; btn.textContent = 'Signing in…';
    try {
      await api('/api/login', { method: 'POST', body: JSON.stringify({ username: username, password: password }) });
      showApp();
      initAppData();
    } catch (err) {
      errEl.textContent = err.message || 'Invalid username or password';
      errEl.hidden = false;
    } finally {
      btn.disabled = false; btn.textContent = 'Sign in';
    }
  });

  $('#logout-btn').addEventListener('click', async function () {
    try { await fetch('/api/logout', { method: 'POST', credentials: 'include' }); } catch (e) {}
    showLogin();
  });

  /* ---------- tabs ---------- */
  $all('.nav-item').forEach(function (btn) {
    btn.addEventListener('click', function () {
      $all('.nav-item').forEach(function (b) { b.classList.remove('is-active'); });
      $all('.tab-panel').forEach(function (p) { p.classList.remove('is-active'); });
      btn.classList.add('is-active');
      $('#tab-' + btn.dataset.tab).classList.add('is-active');
    });
  });

  /* ---------- modal helpers ---------- */
  function openModal(id) { $('#' + id).hidden = false; }
  function closeModal(id) { $('#' + id).hidden = true; }
  $all('[data-close]').forEach(function (btn) {
    btn.addEventListener('click', function () { closeModal(btn.dataset.close); });
  });
  $all('.modal').forEach(function (m) {
    m.addEventListener('click', function (e) { if (e.target === m) m.hidden = true; });
  });

  /* ---------- rich text editor ---------- */
  var TOOLBAR = [
    { cmd: 'bold', label: '<b>B</b>' },
    { cmd: 'italic', label: '<i>I</i>' },
    { cmd: 'underline', label: '<u>U</u>' },
    { cmd: 'insertUnorderedList', label: '&#8226; List' },
    { cmd: 'insertOrderedList', label: '1. List' },
    { cmd: 'formatBlock:H3', label: 'H3' },
    { cmd: 'formatBlock:P', label: 'P' },
    { cmd: 'createLink', label: 'Link' },
    { cmd: 'removeFormat', label: 'Clear' },
  ];

  function createRTE(container) {
    container.innerHTML = '';
    var toolbar = document.createElement('div');
    toolbar.className = 'rte-toolbar';
    var editable = document.createElement('div');
    editable.className = 'rte-editable';
    editable.contentEditable = 'true';
    editable.setAttribute('data-placeholder', 'Write content here…');

    TOOLBAR.forEach(function (t) {
      var b = document.createElement('button');
      b.type = 'button';
      b.innerHTML = t.label;
      b.addEventListener('mousedown', function (e) {
        e.preventDefault();
        editable.focus();
        if (t.cmd === 'createLink') {
          var url = prompt('Link URL:', 'https://');
          if (url) document.execCommand('createLink', false, url);
        } else if (t.cmd.indexOf('formatBlock:') === 0) {
          document.execCommand('formatBlock', false, t.cmd.split(':')[1]);
        } else {
          document.execCommand(t.cmd, false, null);
        }
      });
      toolbar.appendChild(b);
    });

    container.appendChild(toolbar);
    container.appendChild(editable);

    return {
      getHTML: function () { return editable.innerHTML.trim(); },
      setHTML: function (html) { editable.innerHTML = html || ''; },
    };
  }

  /* ---------- image uploader (multi) ---------- */
  function createImageUploader(wrapEl, inputEl, thumbsEl, initial) {
    var items = (initial || []).slice(); // [{url}]

    function render() {
      thumbsEl.innerHTML = '';
      items.forEach(function (item, i) {
        var d = document.createElement('div');
        d.className = 'thumb';
        d.innerHTML = '<img src="' + esc(item.url) + '"><button type="button" class="rm" data-i="' + i + '">&times;</button>';
        thumbsEl.appendChild(d);
      });
    }
    thumbsEl.addEventListener('click', function (e) {
      if (e.target.classList.contains('rm')) {
        items.splice(parseInt(e.target.dataset.i, 10), 1);
        render();
      }
    });
    inputEl.addEventListener('change', async function () {
      var files = Array.prototype.slice.call(inputEl.files);
      inputEl.value = '';
      for (var i = 0; i < files.length; i++) {
        var placeholder = document.createElement('div');
        placeholder.className = 'thumb uploading';
        placeholder.textContent = 'Uploading…';
        thumbsEl.appendChild(placeholder);
        try {
          var url = await uploadFile(files[i]);
          items.push({ url: url });
          render();
        } catch (err) {
          toast('Upload failed: ' + err.message, true);
          placeholder.remove();
        }
      }
    });
    render();
    return {
      getItems: function () { return items.slice(); },
      setItems: function (list) { items = (list || []).slice(); render(); },
    };
  }

  /* ---------- BLOG ---------- */
  var blogRTE = createRTE($('#blog-content-rte'));
  var blogUploader = createImageUploader($('#blog-images-uploader'), $('#blog-images-input'), $('#blog-images-thumbs'), []);
  var blogPosts = [];

  $all('input[name="blog-media-type"]').forEach(function (r) {
    r.addEventListener('change', updateBlogMediaVisibility);
  });
  function updateBlogMediaVisibility() {
    var type = $('input[name="blog-media-type"]:checked').value;
    $('#blog-media-video-wrap').hidden = type !== 'video';
    $('#blog-media-images-wrap').hidden = type === 'video';
  }

  function renderBlogList() {
    var el = $('#blog-list');
    if (!blogPosts.length) {
      el.innerHTML = '<div class="empty-note">No blog posts yet. Click "New blog post" to add one.</div>';
      return;
    }
    el.innerHTML = blogPosts.map(function (p) {
      var img = p.coverImage || (p.media && p.media[0] && p.media[0].url) || '';
      return '<div class="item-card">' +
        (img ? '<img src="' + esc(img) + '">' : '<div style="width:56px;height:56px;background:#eee;border-radius:8px"></div>') +
        '<div class="info"><h4>' + esc(p.title) + '</h4><p>' + esc(p.category || 'Uncategorised') + (p.tags && p.tags.length ? ' · ' + esc(p.tags.join(', ')) : '') + '</p></div>' +
        '<span class="badge' + (p.published !== false ? ' on' : '') + '">' + (p.published !== false ? 'Published' : 'Draft') + '</span>' +
        '<div class="actions">' +
        '<button class="btn btn-sm" data-edit="' + p.id + '">Edit</button>' +
        '<button class="btn btn-sm" data-dup="' + p.id + '">Duplicate</button>' +
        '<button class="btn btn-sm btn-danger" data-del="' + p.id + '">Delete</button>' +
        '</div></div>';
    }).join('');
    $all('[data-edit]', el).forEach(function (b) {
      b.addEventListener('click', function () { openBlogModal(blogPosts.find(function (p) { return p.id === b.dataset.edit; })); });
    });
    $all('[data-dup]', el).forEach(function (b) {
      b.addEventListener('click', function () {
        var src = blogPosts.find(function (p) { return p.id === b.dataset.dup; });
        openBlogModal(Object.assign({}, src, { id: '', title: src.title + ' (Copy)', slug: '' }));
      });
    });
    $all('[data-del]', el).forEach(function (b) {
      b.addEventListener('click', function () { deleteBlog(b.dataset.del); });
    });
  }

  function refreshCategoryList(datalistId, items, field) {
    var vals = Array.from(new Set(items.map(function (i) { return i[field]; }).filter(Boolean)));
    $(datalistId).innerHTML = vals.map(function (v) { return '<option value="' + esc(v) + '">'; }).join('');
  }

  async function loadBlog() {
    blogPosts = await api('/api/blog');
    renderBlogList();
    refreshCategoryList('#blog-category-list', blogPosts, 'category');
  }

  function openBlogModal(post) {
    $('#blog-modal-title').textContent = post ? 'Edit blog post' : 'New blog post';
    $('#blog-id').value = post ? post.id : '';
    $('#blog-title').value = post ? post.title : '';
    $('#blog-excerpt').value = post ? post.excerpt : '';
    $('#blog-category').value = post ? post.category : '';
    $('#blog-tags').value = post && post.tags ? post.tags.join(', ') : '';
    $('#blog-author').value = post ? (post.authorId || '') : '';
    blogRTE.setHTML(post ? post.content : '');
    var mediaType = post ? (post.mediaType || 'grid') : 'grid';
    $all('input[name="blog-media-type"]').forEach(function (r) { r.checked = r.value === mediaType; });
    $('#blog-video-url').value = post ? (post.videoUrl || '') : '';
    blogUploader.setItems(post ? (post.media || []) : []);
    updateBlogMediaVisibility();
    $('#blog-published').checked = !post || post.published !== false;
    openModal('blog-modal');
  }
  $('#blog-new-btn').addEventListener('click', function () { openBlogModal(null); });

  $('#blog-save-btn').addEventListener('click', async function () {
    var title = $('#blog-title').value.trim();
    if (!title) { toast('Title is required', true); return; }
    var payload = {
      id: $('#blog-id').value || undefined,
      title: title,
      excerpt: $('#blog-excerpt').value.trim(),
      content: blogRTE.getHTML(),
      category: $('#blog-category').value.trim(),
      tags: $('#blog-tags').value.split(',').map(function (s) { return s.trim(); }).filter(Boolean),
      authorId: $('#blog-author').value,
      mediaType: $('input[name="blog-media-type"]:checked').value,
      media: blogUploader.getItems(),
      videoUrl: $('#blog-video-url').value.trim(),
      published: $('#blog-published').checked,
    };
    payload.coverImage = payload.media[0] ? payload.media[0].url : '';
    var btn = $('#blog-save-btn');
    btn.disabled = true; btn.textContent = 'Saving…';
    try {
      if (payload.id) {
        await api('/api/blog', { method: 'PUT', body: JSON.stringify(payload) });
      } else {
        delete payload.id;
        await api('/api/blog', { method: 'POST', body: JSON.stringify(payload) });
      }
      closeModal('blog-modal');
      toast('Blog post saved');
      await loadBlog();
    } catch (err) {
      toast(err.message, true);
    } finally {
      btn.disabled = false; btn.textContent = 'Save post';
    }
  });

  async function deleteBlog(id) {
    if (!confirm('Delete this blog post? This cannot be undone.')) return;
    try {
      await api('/api/blog?id=' + encodeURIComponent(id), { method: 'DELETE' });
      toast('Deleted');
      await loadBlog();
    } catch (err) {
      toast(err.message, true);
    }
  }

  /* ---------- PROJECTS ---------- */
  var projectRTE = createRTE($('#project-content-rte'));
  var projectUploader = createImageUploader($('#project-images-uploader'), $('#project-images-input'), $('#project-images-thumbs'), []);
  var projects = [];
  var tableState = { headers: ['Field', 'Value'], rows: [['Status', 'Ongoing'], ['Location', 'Gujarat, India']] };

  function renderTableEditor() {
    var t = $('#project-table-editor');
    var thead = '<thead><tr>' + tableState.headers.map(function (h, ci) {
      return '<th><input type="text" data-h="' + ci + '" value="' + esc(h) + '" placeholder="Header"></th>';
    }).join('') + '</tr></thead>';
    var tbody = '<tbody>' + tableState.rows.map(function (row, ri) {
      return '<tr>' + row.map(function (cell, ci) {
        return '<td><input type="text" data-r="' + ri + '" data-c="' + ci + '" value="' + esc(cell) + '"></td>';
      }).join('') + '</tr>';
    }).join('') + '</tbody>';
    t.innerHTML = thead + tbody;
    $all('th input', t).forEach(function (inp) {
      inp.addEventListener('input', function () { tableState.headers[parseInt(inp.dataset.h, 10)] = inp.value; });
    });
    $all('td input', t).forEach(function (inp) {
      inp.addEventListener('input', function () {
        tableState.rows[parseInt(inp.dataset.r, 10)][parseInt(inp.dataset.c, 10)] = inp.value;
      });
    });
  }
  $('#table-add-row').addEventListener('click', function () {
    tableState.rows.push(tableState.headers.map(function () { return ''; }));
    renderTableEditor();
  });
  $('#table-remove-row').addEventListener('click', function () {
    if (tableState.rows.length > 1) tableState.rows.pop();
    renderTableEditor();
  });
  $('#table-add-col').addEventListener('click', function () {
    tableState.headers.push('');
    tableState.rows.forEach(function (r) { r.push(''); });
    renderTableEditor();
  });
  $('#table-remove-col').addEventListener('click', function () {
    if (tableState.headers.length > 1) {
      tableState.headers.pop();
      tableState.rows.forEach(function (r) { r.pop(); });
    }
    renderTableEditor();
  });

  function renderProjectsList() {
    var el = $('#projects-list');
    if (!projects.length) {
      el.innerHTML = '<div class="empty-note">No projects yet. Click "New project" to add one.</div>';
      return;
    }
    el.innerHTML = projects.map(function (p) {
      var img = p.images && p.images[0] ? p.images[0].url : '';
      return '<div class="item-card">' +
        (img ? '<img src="' + esc(img) + '">' : '<div style="width:56px;height:56px;background:#eee;border-radius:8px"></div>') +
        '<div class="info"><h4>' + esc(p.title) + '</h4><p>' + esc(p.status) + (p.category ? ' · ' + esc(p.category) : '') + '</p></div>' +
        '<span class="badge' + (p.published !== false ? ' on' : '') + '">' + (p.published !== false ? 'Published' : 'Draft') + '</span>' +
        '<div class="actions">' +
        '<button class="btn btn-sm" data-edit="' + p.id + '">Edit</button>' +
        '<button class="btn btn-sm" data-dup="' + p.id + '">Duplicate</button>' +
        '<button class="btn btn-sm btn-danger" data-del="' + p.id + '">Delete</button>' +
        '</div></div>';
    }).join('');
    $all('[data-edit]', el).forEach(function (b) {
      b.addEventListener('click', function () { openProjectModal(projects.find(function (p) { return p.id === b.dataset.edit; })); });
    });
    $all('[data-dup]', el).forEach(function (b) {
      b.addEventListener('click', function () {
        var src = projects.find(function (p) { return p.id === b.dataset.dup; });
        openProjectModal(Object.assign({}, src, { id: '', title: src.title + ' (Copy)', slug: '', legacyUrl: '' }));
      });
    });
    $all('[data-del]', el).forEach(function (b) {
      b.addEventListener('click', function () { deleteProject(b.dataset.del); });
    });
  }

  async function loadProjects() {
    projects = await api('/api/projects');
    renderProjectsList();
    refreshCategoryList('#project-category-list', projects, 'category');
  }

  function openProjectModal(p) {
    $('#project-modal-title').textContent = p ? 'Edit project' : 'New project';
    $('#project-id').value = p ? p.id : '';
    $('#project-title').value = p ? p.title : '';
    $('#project-status').value = p ? p.status : 'Ongoing';
    $('#project-category').value = p ? p.category : '';
    $('#project-tags').value = p && p.tags ? p.tags.join(', ') : '';
    projectRTE.setHTML(p ? p.content : '');
    projectUploader.setItems(p ? (p.images || []) : []);
    tableState = p && p.table && p.table.headers && p.table.headers.length
      ? { headers: p.table.headers.slice(), rows: p.table.rows.map(function (r) { return r.slice(); }) }
      : { headers: ['Field', 'Value'], rows: [['Status', 'Ongoing'], ['Location', 'Gujarat, India']] };
    renderTableEditor();
    $('#project-published').checked = !p || p.published !== false;
    openModal('project-modal');
  }
  $('#projects-new-btn').addEventListener('click', function () { openProjectModal(null); });

  $('#project-save-btn').addEventListener('click', async function () {
    var title = $('#project-title').value.trim();
    if (!title) { toast('Title is required', true); return; }
    var payload = {
      id: $('#project-id').value || undefined,
      title: title,
      status: $('#project-status').value,
      category: $('#project-category').value.trim(),
      tags: $('#project-tags').value.split(',').map(function (s) { return s.trim(); }).filter(Boolean),
      content: projectRTE.getHTML(),
      images: projectUploader.getItems(),
      table: tableState,
      published: $('#project-published').checked,
    };
    var btn = $('#project-save-btn');
    btn.disabled = true; btn.textContent = 'Saving…';
    try {
      if (payload.id) {
        await api('/api/projects', { method: 'PUT', body: JSON.stringify(payload) });
      } else {
        delete payload.id;
        await api('/api/projects', { method: 'POST', body: JSON.stringify(payload) });
      }
      closeModal('project-modal');
      toast('Project saved');
      await loadProjects();
    } catch (err) {
      toast(err.message, true);
    } finally {
      btn.disabled = false; btn.textContent = 'Save project';
    }
  });

  async function deleteProject(id) {
    if (!confirm('Delete this project? This cannot be undone.')) return;
    try {
      await api('/api/projects?id=' + encodeURIComponent(id), { method: 'DELETE' });
      toast('Deleted');
      await loadProjects();
    } catch (err) {
      toast(err.message, true);
    }
  }

  /* ---------- CAREERS ---------- */
  var careerRTE = createRTE($('#career-content-rte'));
  var careers = [];

  function renderCareersList() {
    var el = $('#careers-list');
    if (!careers.length) {
      el.innerHTML = '<div class="empty-note">No openings yet. Click "New opening" to add one.</div>';
      return;
    }
    el.innerHTML = careers.map(function (c) {
      return '<div class="item-card">' +
        '<div class="info"><h4>' + esc(c.title) + '</h4><p>' + esc(c.tag || c.type) + ' · ' + esc(c.location) + '</p></div>' +
        '<span class="badge' + (c.active !== false ? ' on' : '') + '">' + (c.active !== false ? 'Active' : 'Hidden') + '</span>' +
        '<div class="actions">' +
        '<button class="btn btn-sm" data-edit="' + c.id + '">Edit</button>' +
        '<button class="btn btn-sm" data-dup="' + c.id + '">Duplicate</button>' +
        '<button class="btn btn-sm btn-danger" data-del="' + c.id + '">Delete</button>' +
        '</div></div>';
    }).join('');
    $all('[data-edit]', el).forEach(function (b) {
      b.addEventListener('click', function () { openCareerModal(careers.find(function (c) { return c.id === b.dataset.edit; })); });
    });
    $all('[data-dup]', el).forEach(function (b) {
      b.addEventListener('click', function () {
        var src = careers.find(function (c) { return c.id === b.dataset.dup; });
        openCareerModal(Object.assign({}, src, { id: '', title: src.title + ' (Copy)' }));
      });
    });
    $all('[data-del]', el).forEach(function (b) {
      b.addEventListener('click', function () { deleteCareer(b.dataset.del); });
    });
  }

  async function loadCareers() {
    careers = await api('/api/careers');
    renderCareersList();
  }

  function openCareerModal(c) {
    $('#career-modal-title').textContent = c ? 'Edit opening' : 'New opening';
    $('#career-id').value = c ? c.id : '';
    $('#career-title').value = c ? c.title : '';
    $('#career-tag').value = c ? c.tag : '';
    $('#career-type').value = c ? c.type : 'Full-time';
    $('#career-location').value = c ? c.location : 'Ahmedabad';
    $('#career-email').value = c ? c.applyEmail : 'careers@bluewingconstruction.com';
    careerRTE.setHTML(c ? c.description : '');
    $('#career-active').checked = !c || c.active !== false;
    openModal('career-modal');
  }
  $('#careers-new-btn').addEventListener('click', function () { openCareerModal(null); });

  $('#career-save-btn').addEventListener('click', async function () {
    var title = $('#career-title').value.trim();
    if (!title) { toast('Job title is required', true); return; }
    var payload = {
      id: $('#career-id').value || undefined,
      title: title,
      tag: $('#career-tag').value.trim(),
      type: $('#career-type').value,
      location: $('#career-location').value.trim(),
      applyEmail: $('#career-email').value.trim(),
      description: careerRTE.getHTML(),
      active: $('#career-active').checked,
    };
    var btn = $('#career-save-btn');
    btn.disabled = true; btn.textContent = 'Saving…';
    try {
      if (payload.id) {
        await api('/api/careers', { method: 'PUT', body: JSON.stringify(payload) });
      } else {
        delete payload.id;
        await api('/api/careers', { method: 'POST', body: JSON.stringify(payload) });
      }
      closeModal('career-modal');
      toast('Opening saved');
      await loadCareers();
    } catch (err) {
      toast(err.message, true);
    } finally {
      btn.disabled = false; btn.textContent = 'Save opening';
    }
  });

  async function deleteCareer(id) {
    if (!confirm('Delete this opening? This cannot be undone.')) return;
    try {
      await api('/api/careers?id=' + encodeURIComponent(id), { method: 'DELETE' });
      toast('Deleted');
      await loadCareers();
    } catch (err) {
      toast(err.message, true);
    }
  }

  /* ---------- AUTHORS (Settings tab) ---------- */
  var authorUploader = createImageUploader($('#author-image-uploader'), $('#author-image-input'), $('#author-image-thumbs'), []);
  var authors = [];

  function renderAuthorsList() {
    var el = $('#authors-list');
    if (!authors.length) {
      el.innerHTML = '<div class="empty-note">No authors yet. Click "New author" to add one.</div>';
      return;
    }
    el.innerHTML = authors.map(function (a) {
      return '<div class="item-card">' +
        (a.image ? '<img src="' + esc(a.image) + '">' : '<div style="width:56px;height:56px;background:#eee;border-radius:var(--r)"></div>') +
        '<div class="info"><h4>' + esc(a.name) + '</h4><p>' + esc(a.designation || '') + '</p></div>' +
        '<div class="actions">' +
        '<button class="btn btn-sm" data-edit="' + a.id + '">Edit</button>' +
        '<button class="btn btn-sm btn-danger" data-del="' + a.id + '">Delete</button>' +
        '</div></div>';
    }).join('');
    $all('[data-edit]', el).forEach(function (b) {
      b.addEventListener('click', function () { openAuthorModal(authors.find(function (a) { return a.id === b.dataset.edit; })); });
    });
    $all('[data-del]', el).forEach(function (b) {
      b.addEventListener('click', function () { deleteAuthor(b.dataset.del); });
    });
  }

  function populateAuthorSelect() {
    var sel = $('#blog-author');
    var current = sel.value;
    sel.innerHTML = '<option value="">No author</option>' + authors.map(function (a) {
      return '<option value="' + esc(a.id) + '">' + esc(a.name) + '</option>';
    }).join('');
    sel.value = current;
  }

  async function loadAuthors() {
    authors = await api('/api/authors');
    renderAuthorsList();
    populateAuthorSelect();
  }

  function openAuthorModal(a) {
    $('#author-modal-title').textContent = a ? 'Edit author' : 'New author';
    $('#author-id').value = a ? a.id : '';
    $('#author-name').value = a ? a.name : '';
    $('#author-designation').value = a ? a.designation : '';
    authorUploader.setItems(a && a.image ? [{ url: a.image }] : []);
    openModal('author-modal');
  }
  $('#author-new-btn').addEventListener('click', function () { openAuthorModal(null); });

  $('#author-save-btn').addEventListener('click', async function () {
    var name = $('#author-name').value.trim();
    if (!name) { toast('Name is required', true); return; }
    var items = authorUploader.getItems();
    var payload = {
      id: $('#author-id').value || undefined,
      name: name,
      designation: $('#author-designation').value.trim(),
      image: items.length ? items[items.length - 1].url : '',
    };
    var btn = $('#author-save-btn');
    btn.disabled = true; btn.textContent = 'Saving…';
    try {
      if (payload.id) {
        await api('/api/authors', { method: 'PUT', body: JSON.stringify(payload) });
      } else {
        delete payload.id;
        await api('/api/authors', { method: 'POST', body: JSON.stringify(payload) });
      }
      closeModal('author-modal');
      toast('Author saved');
      await loadAuthors();
    } catch (err) {
      toast(err.message, true);
    } finally {
      btn.disabled = false; btn.textContent = 'Save author';
    }
  });

  async function deleteAuthor(id) {
    if (!confirm('Delete this author? Posts assigned to them will show no author.')) return;
    try {
      await api('/api/authors?id=' + encodeURIComponent(id), { method: 'DELETE' });
      toast('Deleted');
      await loadAuthors();
    } catch (err) {
      toast(err.message, true);
    }
  }

  /* ---------- init ---------- */
  function initAppData() {
    loadBlog().catch(function (e) { toast(e.message, true); });
    loadProjects().catch(function (e) { toast(e.message, true); });
    loadCareers().catch(function (e) { toast(e.message, true); });
    loadAuthors().catch(function (e) { toast(e.message, true); });
  }

  checkSession();
})();
