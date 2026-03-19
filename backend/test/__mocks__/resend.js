'use strict';

class Resend {
  constructor() {}
  get emails() {
    return {
      send: async () => ({ data: { id: 'mock-email-id' }, error: null }),
    };
  }
}

module.exports = { Resend };
