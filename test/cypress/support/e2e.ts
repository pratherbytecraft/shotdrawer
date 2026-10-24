// cy.page('panel/index.html', change) loads a renderer page with the fake
// window.shotdrawer in place. change(state) can adjust the state before the
// page reads it. cy.fake() yields the fake.
import { fakeShotdrawer, type Fake } from './fake';
import type { State } from '../../../src/shared/types';

declare global {
  namespace Cypress {
    interface Chainable {
      page(url: string, change?: (state: State) => void): Chainable<void>;
      fake(): Chainable<Fake>;
      calls(name: string): Chainable<unknown[][]>;
    }
  }
}

Cypress.Commands.add('page', (url: string, change?: (state: State) => void) => {
  cy.task<string[]>('apiNames', null, { log: false }).then((names) => {
    cy.task<State>('shotdrawerState', null, { log: false }).then((state) => {
      if (change) change(state);
      cy.visit(`${Cypress.env('pages')}/${url}`, {
        onBeforeLoad(win) {
          win.shotdrawer = fakeShotdrawer(names, state);
        }
      });
    });
  });
});

Cypress.Commands.add('fake', () => cy.window({ log: false }).then((win) => win.shotdrawer as Fake));

// The calls the page made to one of the fake's functions, as argument lists.
// Retries like any query, so should() waits for a call to come in.
Cypress.Commands.addQuery('calls', (name: string) => {
  return () => {
    // cy.state is Cypress's own, left out of its types.
    const api = (cy as unknown as { state(key: 'window'): Window }).state('window').shotdrawer as Fake;
    return api.calls.filter((c) => c[0] === name).map((c) => c.slice(1));
  };
});
