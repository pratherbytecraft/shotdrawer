// cy.page('panel/index.html', change) loads a renderer page with the fake
// window.shotdrawer in place. change(state) can adjust the state before the
// page reads it. cy.fake() yields the fake.
import { fakeShotdrawer } from './fake';

Cypress.Commands.add('page', (url, change) => {
  cy.task('apiNames', null, { log: false }).then((names) => {
    cy.task('shotdrawerState', null, { log: false }).then((state) => {
      if (change) change(state);
      cy.visit(`${Cypress.env('pages')}/${url}`, {
        onBeforeLoad(win) {
          win.shotdrawer = fakeShotdrawer(names, state);
        }
      });
    });
  });
});

Cypress.Commands.add('fake', () => cy.window({ log: false }).then((win) => win.shotdrawer));

// The calls the page made to one of the fake's functions, as argument lists.
// Retries like any query, so should() waits for a call to come in.
Cypress.Commands.addQuery('calls', (name) => {
  return () => {
    const api = cy.state('window').shotdrawer;
    return api.calls.filter((c) => c[0] === name).map((c) => c.slice(1));
  };
});
