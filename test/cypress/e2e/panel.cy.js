// The list under the menu bar icon, with the fake's five screenshots.
const row = (name) => cy.get(`[data-path$="/${name}"]`);

describe('the list', () => {
  it('groups screenshots by day, newest first, with their sizes', () => {
    cy.page('panel/index.html');
    cy.get('#count').should('have.text', '5');
    cy.get('.day').then((days) => expect([...days].map((d) => d.textContent)).to.deep.equal(['Today', 'Yesterday', 'Earlier']));
    cy.get('.row').should('have.length', 5).first().should('have.attr', 'data-path').and('match', /today b\.png$/);
    cy.get('.row').first().find('.l1').should('contain', 'min ago');
    cy.get('.row').first().find('.l2').should('have.text', '1512 × 861 · 295 KB');
    cy.get('.row').last().find('.l1').should('not.contain', 'ago');
  });

  it('a click copies the path and shows Copied', () => {
    cy.page('panel/index.html');
    row('Screenshot yesterday.png').find('.info').click();
    cy.calls('copy').should('deep.equal', [['/Users/test/Documents/Temp Screenshots/Screenshot yesterday.png']]);
    row('Screenshot yesterday.png').find('.copied').should('contain', 'Copied');
  });

  it('Cmd click and Shift click pick several, Copy Paths copies them in list order, Esc clears', () => {
    cy.page('panel/index.html', (state) => {
      state.settings.closeAfterCopy = false;
    });
    row('Screenshot earlier b.png').find('.info').click({ metaKey: true });
    row('Screenshot today a.png').find('.info').click({ shiftKey: true });
    cy.get('.row.sel').should('have.length', 3);
    cy.calls('copy').should('have.length', 0);
    cy.get('#sel-msg').should('contain', '3 selected').and('contain', 'one per line');
    cy.get('#sel-copy').should('have.text', 'Copy 3 Paths').click();
    cy.calls('copyMany').should('deep.equal', [[[
      '/Users/test/Documents/Temp Screenshots/Screenshot today a.png',
      '/Users/test/Documents/Temp Screenshots/Screenshot yesterday.png',
      '/Users/test/Documents/Temp Screenshots/Screenshot earlier b.png'
    ]]]);
    cy.get('#sel-copy').should('have.text', 'Copied');
    cy.get('body').type('{esc}');
    cy.get('.row.sel').should('have.length', 0);
    cy.get('#selbar').should('not.be.visible');
    cy.calls('hide').should('have.length', 0);
  });

  it('the list closes a moment after a copy, or stays with the switch off', () => {
    cy.page('panel/index.html');
    row('Screenshot yesterday.png').find('.info').click();
    cy.calls('hide').should('have.length', 0);
    cy.calls('hide').should('have.length', 1);
    cy.page('panel/index.html', (state) => {
      state.settings.closeAfterCopy = false;
    });
    row('Screenshot yesterday.png').find('.info').click();
    cy.wait(800);
    cy.calls('hide').should('have.length', 0);
  });

  it('a click in the list right after a copy keeps it open', () => {
    cy.page('panel/index.html');
    row('Screenshot yesterday.png').find('.info').click();
    row('Screenshot today a.png').find('.info').click({ metaKey: true });
    cy.wait(800);
    cy.calls('hide').should('have.length', 0);
  });

  it('Cmd click on a picked one unpicks it', () => {
    cy.page('panel/index.html');
    row('Screenshot yesterday.png').find('.info').click({ metaKey: true });
    row('Screenshot yesterday.png').find('.info').click({ metaKey: true });
    cy.get('.row.sel').should('have.length', 0);
  });

  it('the right click menu gets the picked ones only when the row is one of them', () => {
    cy.page('panel/index.html');
    row('Screenshot today b.png').find('.info').click({ metaKey: true });
    row('Screenshot today a.png').find('.info').click({ metaKey: true });
    row('Screenshot today a.png').rightclick();
    row('Screenshot yesterday.png').rightclick();
    cy.calls('menu').should('deep.equal', [
      ['/Users/test/Documents/Temp Screenshots/Screenshot today a.png', [
        '/Users/test/Documents/Temp Screenshots/Screenshot today b.png',
        '/Users/test/Documents/Temp Screenshots/Screenshot today a.png'
      ]],
      ['/Users/test/Documents/Temp Screenshots/Screenshot yesterday.png', []]
    ]);
  });

  it('a copy from the right click menu shows Copied', () => {
    cy.page('panel/index.html');
    cy.get('.row').should('have.length', 5);
    cy.fake().then((api) => api.emit('copied', '/Users/test/Documents/Temp Screenshots/Screenshot today a.png'));
    row('Screenshot today a.png').find('.copied').should('exist');
  });

  it('the hover buttons show the screenshot or open its menu, without copying', () => {
    cy.page('panel/index.html');
    row('Screenshot today a.png').find('[data-act="show"]').should('have.attr', 'title', 'Show in Finder').click({ force: true });
    row('Screenshot today a.png').find('[data-act="menu"]').click({ force: true });
    cy.calls('show').should('deep.equal', [['/Users/test/Documents/Temp Screenshots/Screenshot today a.png']]);
    cy.calls('menu').should('have.length', 1);
    cy.calls('copy').should('have.length', 0);
  });

  it('the file name shows when the pointer rests on a row, but not on its buttons', () => {
    cy.page('panel/index.html');
    row('Screenshot yesterday.png').find('.info').trigger('mouseover');
    cy.get('#tip', { timeout: 2000 }).should('not.have.attr', 'hidden');
    cy.get('#tip').should('have.text', 'Screenshot yesterday.png');
    row('Screenshot yesterday.png').find('[data-act="show"]').trigger('mouseover', { force: true });
    cy.get('#tip').should('have.attr', 'hidden');
  });

  it('dragging a picture hands the file over', () => {
    cy.page('panel/index.html');
    row('Screenshot yesterday.png').find('.th').trigger('dragstart');
    cy.calls('drag').its(0).its(0).should('deep.equal', ['/Users/test/Documents/Temp Screenshots/Screenshot yesterday.png']);
  });

  it('Grid shows tiles with the time under each', () => {
    cy.page('panel/index.html', (state) => {
      state.settings.layout = 'grid';
    });
    cy.get('.tile').should('have.length', 5);
    cy.get('.row').should('have.length', 0);
    cy.get('.tile .cap').first().invoke('text').should('match', /\d:\d\d/);
  });

  it('Clear History asks first, and Cancel keeps the list', () => {
    cy.page('panel/index.html');
    cy.get('#clear').click();
    cy.get('#confirm-msg').should('have.text', 'Clear all 5 from the list? The files stay where they are.');
    cy.get('#confirm-cancel').click();
    cy.get('#confirm').should('not.be.visible');
    cy.get('#clear').click();
    cy.get('#confirm-clear').click();
    cy.calls('clearHistory').should('have.length', 1);
    cy.get('.empty .big').should('have.text', 'No screenshots yet');
    cy.get('#clear').should('be.disabled');
  });

  it('says when it can\'t open the folder, with a way to System Settings', () => {
    cy.page('panel/index.html', (state) => {
      state.access = 'denied';
    });
    cy.get('.empty .big').should('have.text', 'Shotdrawer can\'t open Temp Screenshots');
    cy.get('#privacy').click();
    cy.calls('openPrivacy').should('have.length', 1);
  });

  it('says when the folder is gone', () => {
    cy.page('panel/index.html', (state) => {
      state.access = 'missing';
      state.shots = [];
    });
    cy.get('.empty .big').should('have.text', 'Temp Screenshots isn\'t there anymore');
  });

  it('the footer and the gear reach the folder menu, settings and Quit', () => {
    cy.page('panel/index.html');
    cy.get('#folder').should('contain', 'Temp Screenshots').click();
    cy.get('#gear').click();
    cy.get('#quit').click();
    cy.calls('folderMenu').should('have.length', 1);
    cy.calls('openSettings').should('have.length', 1);
    cy.calls('quit').should('have.length', 1);
  });

  it('Esc with nothing picked closes the list', () => {
    cy.page('panel/index.html');
    cy.get('.row').should('have.length', 5);
    cy.get('body').type('{esc}');
    cy.calls('hide').should('have.length', 1);
  });
});
