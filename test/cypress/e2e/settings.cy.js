// The settings window, with every setting at its default unless a test says.
const open = (title) => cy.contains('#nav a', title).click();

describe('settings window', () => {
  it('draws every page from the sidebar', () => {
    cy.page('settings/index.html');
    for (const title of ['General', 'Look', 'About']) {
      open(title);
      cy.get('#title').should('have.text', title);
      cy.get('.page.on').should('be.visible');
    }
  });

  it('opens on the page it was asked for', () => {
    cy.page('settings/index.html?page=about');
    cy.get('#title').should('have.text', 'About');
    cy.fake().then((api) => api.emit('settingsPage', 'look'));
    cy.get('#title').should('have.text', 'Look');
  });

  it('the stepper keeps 5 to 100 in steps of 5', () => {
    cy.page('settings/index.html', (state) => {
      state.settings.historySize = 95;
    });
    cy.get('#size').should('have.text', '95 screenshots');
    cy.get('#size-up').click();
    cy.calls('set').should('deep.equal', [[{ historySize: 100 }]]);
    cy.get('#size').should('have.text', '100 screenshots');
    cy.get('#size-up').should('be.disabled');
    cy.get('#size-down').click();
    cy.calls('set').should('deep.include', [{ historySize: 95 }]);
  });

  it('the copy format sends its choice and the sample shows what lands on the clipboard', () => {
    cy.page('settings/index.html');
    cy.get('#sample').should('have.text',
      '/Users/test/Documents/Temp Screenshots/Screenshot today b.png\n/Users/test/Documents/Temp Screenshots/Screenshot today a.png');
    cy.get('#format').select('quoted');
    cy.calls('set').should('deep.include', [{ copyFormat: 'quoted' }]);
    cy.get('#sample').should('have.text',
      "'/Users/test/Documents/Temp Screenshots/Screenshot today b.png' '/Users/test/Documents/Temp Screenshots/Screenshot today a.png'");
  });

  it('the sample shell quotes a path with a quote in it', () => {
    cy.page('settings/index.html', (state) => {
      state.settings.copyFormat = 'quoted';
      state.shots = state.shots.slice(4);
    });
    cy.get('#sample').should('contain', "'/Users/test/Documents/Temp Screenshots/Sam'\\''s Screenshot.png'");
  });

  it('Show screenshots in is there only with Filedrawer', () => {
    cy.page('settings/index.html');
    cy.get('#showin-row').should('not.be.visible');
    cy.get('#show-folder').should('have.text', 'Show in Finder');
    cy.page('settings/index.html', (state) => {
      state.filedrawer = true;
      state.viewer = 'Filedrawer';
    });
    cy.get('#showin-row').should('be.visible');
    cy.get('#show-folder').should('have.text', 'Show in Filedrawer');
    cy.contains('#showin button', 'Finder').click();
    cy.calls('set').should('deep.include', [{ showIn: 'finder' }]);
  });

  it('the menu bar icon choice is there only with Startbar', () => {
    cy.page('settings/index.html');
    cy.get('#menubar-section').should('not.be.visible');
    cy.page('settings/index.html', (state) => {
      state.startbar = true;
    });
    cy.get('#menubar').should('be.visible').and('have.value', 'auto').select('always');
    cy.calls('set').should('deep.include', [{ menuBarIcon: 'always' }]);
  });

  it('the Close the list after copying switch sends its setting', () => {
    cy.page('settings/index.html');
    cy.get('#close-after').should('not.have.class', 'on').click();
    cy.calls('set').should('deep.include', [{ closeAfterCopy: true }]);
    cy.get('#close-after').should('have.class', 'on');
  });

  it('the folder buttons and the login switch reach the main process', () => {
    cy.page('settings/index.html');
    cy.get('#folder').should('have.text', '/Users/test/Documents/Temp Screenshots');
    cy.get('#show-folder').click();
    cy.get('#change-folder').click();
    cy.get('#login').should('have.class', 'on').click();
    cy.calls('showFolder').should('have.length', 1);
    cy.calls('changeFolder').should('have.length', 1);
    cy.calls('setLoginItem').should('deep.equal', [[false]]);
    cy.get('#login').should('not.have.class', 'on');
  });

  it('Look has the big look switch, on by default', () => {
    cy.page('settings/index.html');
    open('Look');
    cy.get('#big-look').should('have.class', 'on').click();
    cy.calls('set').should('deep.include', [{ bigLook: false }]);
  });

  it('Look sends List or Grid', () => {
    cy.page('settings/index.html');
    open('Look');
    cy.contains('#layout button', 'List').should('have.class', 'on');
    cy.contains('#layout button', 'Grid').click();
    cy.calls('set').should('deep.include', [{ layout: 'grid' }]);
    cy.contains('#layout button', 'Grid').should('have.class', 'on');
  });

  it('About shows the version, the links and the update line for how Shotdrawer was installed', () => {
    cy.page('settings/index.html', (state) => {
      state.update = { state: 'available', latest: '9.9.10' };
      state.updateCommand = 'brew upgrade shotdrawer';
    });
    open('About');
    cy.get('#version').should('have.text', 'Version 9.9.9');
    cy.get('#update-line').should('contain', 'Version 9.9.10 is out');
    cy.get('#update-cmd').should('have.text', 'brew upgrade shotdrawer');
    cy.get('#copy-cmd').click().should('have.text', 'Copied');
    cy.calls('copyText').should('deep.equal', [['brew upgrade shotdrawer']]);
    cy.get('#check').click();
    cy.calls('checkUpdates').should('have.length', 1);
    for (const link of ['website', 'github', 'community', 'kofi']) cy.get(`[data-link="${link}"]`).click();
    cy.calls('openLink').should('deep.equal', [['website'], ['github'], ['community'], ['kofi']]);
  });

  it('About lists the other apps, Open for one that\'s installed and its install line for one that isn\'t', () => {
    cy.page('settings/index.html?page=about');
    cy.get('.sib[data-key="startbar"]').should('contain', 'Installed').find('code').should('not.exist');
    cy.get('.sib[data-key="startbar"] [data-act="open"]').click();
    cy.calls('openSibling').should('deep.equal', [['startbar']]);
    cy.get('.sib[data-key="filedrawer"] code').should('have.text', 'npm install -g filedrawer');
    cy.get('.sib[data-key="filedrawer"] [data-act="copy"]').click();
    cy.calls('copyText').should('deep.equal', [['npm install -g filedrawer']]);
    cy.get('.sib[data-key="filedrawer"] [data-act="copy"]').should('have.text', 'Copied');
  });

  it('no update line row until one is out', () => {
    cy.page('settings/index.html?page=about');
    cy.get('#update-row').should('not.be.visible');
  });

  it('search keeps only the rows that match, from every page', () => {
    cy.page('settings/index.html');
    cy.get('#search').type('grid');
    cy.get('#title').should('have.text', 'Search');
    cy.get('.r:visible').should('have.length', 1).and('contain', 'Layout');
    cy.get('#search').clear().type('copy');
    // Copy several paths as, its sample, Close the list after copying, and
    // Filedrawer's row with its Copy button.
    cy.get('.r:visible').should('have.length', 4).last().should('contain', 'Filedrawer');
    cy.get('#sample').should('be.visible');
    cy.get('#search').clear().type('menu bar icon');
    cy.get('.none-found').should('be.visible');
    cy.get('#search').clear().type('nothing like this');
    cy.get('.none-found').should('be.visible');
  });
});
