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

  it('the time comes from the screenshot\'s name when it has one', () => {
    let named;
    cy.page('panel/index.html', (state) => {
      // Yesterday at 2:15:07 PM by its name, written to disk at 2:16:02.
      const d = new Date();
      d.setDate(d.getDate() - 1);
      const ymd = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      named = `Screenshot ${ymd} at 2.15.07\u202fPM.png`;
      state.shots[2] = { path: `${state.folder}/${named}`, at: new Date(d.getFullYear(), d.getMonth(), d.getDate(), 14, 16, 2).getTime() };
    });
    cy.then(() => row(named).find('.l1').invoke('text').should('match', /^2:15[\s\u202f]PM/));
  });

  it('a name far from when the file was made isn\'t trusted', () => {
    let named;
    cy.page('panel/index.html', (state) => {
      named = 'Screenshot 2019-03-02 at 10.01.22 AM.png';
      state.shots[2] = { path: `${state.folder}/${named}`, at: new Date().setHours(0, 0, 0, 0) - 10 * 60 * 60 * 1000 };
    });
    cy.then(() => row(named).find('.l1').invoke('text').should('match', /^2:00[\s\u202f]PM/));
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

  it('the list stays open after a copy, or closes a moment later with the switch on', () => {
    cy.page('panel/index.html', (state) => {
      state.settings.closeAfterCopy = true;
    });
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
    cy.page('panel/index.html', (state) => {
      state.settings.closeAfterCopy = true;
    });
    row('Screenshot yesterday.png').find('.info').click();
    row('Screenshot today a.png').find('.info').click({ metaKey: true });
    cy.wait(800);
    cy.calls('hide').should('have.length', 0);
  });

  it('the circle on a picture picks it without copying, in List and Grid', () => {
    cy.page('panel/index.html');
    row('Screenshot yesterday.png').find('.pick').click({ force: true });
    cy.get('.row.sel').should('have.length', 1);
    cy.calls('copy').should('have.length', 0);
    cy.get('#sel-msg').should('contain', '1 selected');
    // Once something's picked the circles at the left take over.
    cy.get('.list.picking').should('exist');
    cy.page('panel/index.html', (state) => {
      state.settings.layout = 'grid';
    });
    cy.get('.tile').eq(1).find('.pick').click({ force: true });
    cy.get('.tile.sel').should('have.length', 1);
    cy.calls('copy').should('have.length', 0);
  });

  it('while some are picked a plain click picks or unpicks, without copying', () => {
    cy.page('panel/index.html');
    row('Screenshot today b.png').find('.info').click({ metaKey: true });
    row('Screenshot yesterday.png').find('.info').click();
    cy.get('.row.sel').should('have.length', 2);
    row('Screenshot today b.png').find('.info').click();
    cy.get('.row.sel').should('have.length', 1);
    cy.calls('copy').should('have.length', 0);
    // Return copies the picked one.
    cy.get('body').type('{enter}');
    cy.calls('copyMany').should('deep.equal', [[['/Users/test/Documents/Temp Screenshots/Screenshot yesterday.png']]]);
  });

  it('a click after a sweep adds to the picks', () => {
    cy.page('panel/index.html');
    row('Screenshot today b.png').find('.info').trigger('mousedown', { button: 0 });
    row('Screenshot today a.png').find('.info').trigger('mouseover', { buttons: 1 });
    cy.window().trigger('mouseup');
    cy.get('.row.sel').should('have.length', 2);
    row('Screenshot earlier b.png').find('.info').click();
    cy.get('.row.sel').should('have.length', 3);
    cy.calls('copy').should('have.length', 0);
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

  it('after Remove from History, Undo lets them back in', () => {
    cy.page('panel/index.html');
    cy.get('.row').should('have.length', 5);
    cy.fake().then((api) => api.emit('removed', ['/a.png', '/b.png']));
    cy.get('#undo-msg').should('have.text', 'Removed 2 screenshots from the list.');
    cy.get('#undo').click();
    cy.calls('unremove').should('deep.equal', [[['/a.png', '/b.png']]]);
    // The line stays, so the footer doesn't slide up under the pointer.
    cy.get('#undo-msg').should('have.text', 'Back in the list.');
    cy.get('#undo').should('have.css', 'visibility', 'hidden');
  });

  it('the arrows move a ring through the list, Return copies, Shift picks as it moves', () => {
    cy.page('panel/index.html', (state) => {
      state.settings.closeAfterCopy = false;
    });
    cy.get('.row').should('have.length', 5);
    cy.get('body').type('{downarrow}');
    cy.get('.row.kb').should('have.length', 1).and('have.attr', 'data-path').and('match', /today b\.png$/);
    cy.get('body').type('{downarrow}{downarrow}');
    cy.get('.row.kb').should('have.attr', 'data-path').and('match', /yesterday\.png$/);
    cy.get('body').type('{uparrow}');
    cy.get('.row.kb').should('have.attr', 'data-path').and('match', /today a\.png$/);
    cy.get('body').type('{enter}');
    cy.calls('copy').should('deep.equal', [['/Users/test/Documents/Temp Screenshots/Screenshot today a.png']]);
    cy.get('body').type('{shift}{downarrow}{downarrow}');
    cy.get('.row.sel').should('have.length', 3);
  });

  it('Cmd A picks all, Cmd C copies the picked ones, Cmd Delete trashes them', () => {
    cy.page('panel/index.html', (state) => {
      state.settings.closeAfterCopy = false;
    });
    cy.get('.row').should('have.length', 5);
    cy.get('body').type('{cmd}a');
    cy.get('.row.sel').should('have.length', 5);
    cy.get('body').type('{cmd}c');
    cy.calls('copyMany').its(0).its(0).should('have.length', 5);
    cy.get('body').type('{cmd}{backspace}');
    cy.calls('trash').its(0).its(0).should('have.length', 5);
  });

  it('Cmd C with nothing picked copies the row the keys are on', () => {
    cy.page('panel/index.html', (state) => {
      state.settings.closeAfterCopy = false;
    });
    cy.get('.row').should('have.length', 5);
    cy.get('body').type('{downarrow}{cmd}c');
    cy.calls('copy').should('deep.equal', [['/Users/test/Documents/Temp Screenshots/Screenshot today b.png']]);
  });

  it('in Grid, Left and Right step and Down goes to the next row of pictures', () => {
    cy.page('panel/index.html', (state) => {
      state.settings.layout = 'grid';
    });
    cy.get('.tile').should('have.length', 5);
    cy.get('body').type('{rightarrow}{rightarrow}');
    cy.get('.tile.kb').should('have.attr', 'data-path').and('match', /today a\.png$/);
    cy.get('body').type('{downarrow}');
    cy.get('.tile.kb').should('have.attr', 'data-path').and('match', /yesterday\.png$/);
  });

  it('Esc with nothing picked closes the list', () => {
    cy.page('panel/index.html');
    cy.get('.row').should('have.length', 5);
    cy.get('body').type('{esc}');
    cy.calls('hide').should('have.length', 1);
  });
});
