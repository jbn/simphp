/*
 * FiddleStore: fiddles (projects) and their files in IndexedDB.
 *
 * IndexedDB rather than localStorage because a fiddle's disk holds binary
 * files (uploads, MySQL databases as SQLite images) and many fiddles add up
 * past localStorage's ~5 MB of strings. Files are stored one record each, so
 * saving an edit writes only that file.
 *
 *   projects  { id, name, created, updated, ...ui state }       key: id
 *   files     { pid, path, data: Uint8Array|null, mtime }       key: [pid, path]
 *   versions  { pid, n, created, hash, files: {path: bytes}, ... } key: [pid, n]
 *   meta      { key, value }                                    key: key
 *
 * If IndexedDB is unavailable (blocked storage, some private windows) the
 * same API works in memory and `persistent` is false.
 */
(function (root) {
  'use strict';

  const DB_NAME = 'simphp-fiddle';
  const req2p = (r) => new Promise((resolve, reject) => { r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error); });
  const tx2p = (t) => new Promise((resolve, reject) => { t.oncomplete = () => resolve(); t.onerror = () => reject(t.error); t.onabort = () => reject(t.error || new Error('aborted')); });

  class FiddleStore {
    constructor() {
      this.db = null;
      this.persistent = false;
      this.mem = { projects: new Map(), files: new Map(), meta: new Map(), versions: new Map() };
    }

    async open() {
      try {
        const r = indexedDB.open(DB_NAME, 2);
        r.onupgradeneeded = (ev) => {
          const db = r.result;
          if (ev.oldVersion < 1) {
            db.createObjectStore('projects', { keyPath: 'id' });
            db.createObjectStore('files', { keyPath: ['pid', 'path'] }).createIndex('pid', 'pid');
            db.createObjectStore('meta', { keyPath: 'key' });
          }
          if (ev.oldVersion < 2) db.createObjectStore('versions', { keyPath: ['pid', 'n'] }).createIndex('pid', 'pid');
        };
        this.db = await req2p(r);
        // let a newer version of this page (in another tab) upgrade the database
        this.db.onversionchange = () => this.db.close();
        this.persistent = true;
        // Ask the browser not to evict fiddles under storage pressure.
        if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
      } catch (e) {
        this.db = null;
        this.persistent = false;
      }
      return this.persistent;
    }

    async listProjects() {
      if (!this.db) return [...this.mem.projects.values()];
      return req2p(this.db.transaction('projects').objectStore('projects').getAll());
    }

    async getProject(id) {
      if (!this.db) return this.mem.projects.get(id) || null;
      return (await req2p(this.db.transaction('projects').objectStore('projects').get(id))) || null;
    }

    /** { path: {data, mtime} | null } for one fiddle */
    async getFiles(pid) {
      const out = {};
      if (!this.db) {
        for (const [k, f] of this.mem.files) if (k[0] === pid) out[f.path] = f.data === null ? null : { data: f.data, mtime: f.mtime };
        return out;
      }
      const recs = await req2p(this.db.transaction('files').objectStore('files').index('pid').getAll(pid));
      for (const f of recs) out[f.path] = f.data === null ? null : { data: f.data, mtime: f.mtime };
      return out;
    }

    /**
     * Save a fiddle record and, in the same transaction, the given files:
     * changes = { path: {data, mtime} | null (directory) | undefined (deleted) }
     */
    async save(project, changes) {
      changes = changes || {};
      if (!this.db) {
        this.mem.projects.set(project.id, project);
        for (const [path, f] of Object.entries(changes)) {
          const key = project.id + '\0' + path;
          if (f === undefined) this.mem.files.delete(key);
          else this.mem.files.set(key, { pid: project.id, path, data: f ? f.data : null, mtime: f ? f.mtime : 0 });
        }
        return;
      }
      const t = this.db.transaction(['projects', 'files'], 'readwrite');
      t.objectStore('projects').put(project);
      const fs = t.objectStore('files');
      for (const [path, f] of Object.entries(changes)) {
        if (f === undefined) fs.delete([project.id, path]);
        else fs.put({ pid: project.id, path, data: f ? f.data : null, mtime: f ? f.mtime : 0 });
      }
      return tx2p(t);
    }

    async deleteProject(pid) {
      if (!this.db) {
        this.mem.projects.delete(pid);
        for (const k of [...this.mem.files.keys()]) if (k.startsWith(pid + '\0')) this.mem.files.delete(k);
        for (const k of [...this.mem.versions.keys()]) if (k.startsWith(pid + '\0')) this.mem.versions.delete(k);
        return;
      }
      const t = this.db.transaction(['projects', 'files', 'versions'], 'readwrite');
      t.objectStore('projects').delete(pid);
      for (const name of ['files', 'versions']) {
        const os = t.objectStore(name);
        const cur = os.index('pid').openKeyCursor(IDBKeyRange.only(pid));
        cur.onsuccess = () => {
          const c = cur.result;
          if (c) { os.delete(c.primaryKey); c.continue(); }
        };
      }
      return tx2p(t);
    }

    /** Saved versions of a fiddle, oldest first, without their files. */
    async listVersions(pid) {
      let recs;
      if (!this.db) recs = [...this.mem.versions.values()].filter((v) => v.pid === pid);
      else recs = await req2p(this.db.transaction('versions').objectStore('versions').index('pid').getAll(pid));
      return recs.map(({ files, ...v }) => Object.assign(v, { fileCount: Object.keys(files).length })).sort((a, b) => a.n - b.n);
    }

    async getVersion(pid, n) {
      if (!this.db) return this.mem.versions.get(pid + '\0' + n) || null;
      return (await req2p(this.db.transaction('versions').objectStore('versions').get([pid, n]))) || null;
    }

    async putVersion(v) {
      if (!this.db) { this.mem.versions.set(v.pid + '\0' + v.n, v); return; }
      const t = this.db.transaction('versions', 'readwrite');
      t.objectStore('versions').put(v);
      return tx2p(t);
    }

    async deleteVersion(pid, n) {
      if (!this.db) { this.mem.versions.delete(pid + '\0' + n); return; }
      const t = this.db.transaction('versions', 'readwrite');
      t.objectStore('versions').delete([pid, n]);
      return tx2p(t);
    }

    async getMeta(key) {
      if (!this.db) return this.mem.meta.get(key);
      const r = await req2p(this.db.transaction('meta').objectStore('meta').get(key));
      return r ? r.value : undefined;
    }

    async setMeta(key, value) {
      if (!this.db) { this.mem.meta.set(key, value); return; }
      const t = this.db.transaction('meta', 'readwrite');
      t.objectStore('meta').put({ key, value });
      return tx2p(t);
    }
  }

  root.FiddleStore = FiddleStore;
})(typeof self !== 'undefined' ? self : this);
