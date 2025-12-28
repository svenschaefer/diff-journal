// src/index.js

export function openDiffJournal(options = {}) {
  const { rootDir } = options;

  if (!rootDir) {
    throw new Error("openDiffJournal: 'rootDir' is required");
  }

  return {
    async append(change) {
      throw new Error("append() not implemented yet");
    },

    async materialize(file) {
      throw new Error("materialize() not implemented yet");
    },

    async rollback(file, { seq }) {
      throw new Error("rollback() not implemented yet");
    }
  };
}
