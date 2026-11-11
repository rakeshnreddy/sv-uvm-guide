// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';

import { focusableWithin } from '@/components/search/useModalDialog';

function mount(html: string): HTMLElement {
  const container = document.createElement('div');
  container.innerHTML = html;
  document.body.appendChild(container);
  return container;
}

const ids = (elements: HTMLElement[]) => elements.map((element) => element.id);

afterEach(() => {
  document.body.innerHTML = '';
});

describe('focusableWithin', () => {
  const themeGroup = (checked: 'light' | 'dark' | 'system' | null) => `
    <button id="close">Close</button>
    <a id="link" href="/curriculum">Curriculum</a>
    <div role="radiogroup">
      ${['light', 'dark', 'system']
        .map((value) => `<input id="${value}" type="radio" name="theme" value="${value}"${checked === value ? ' checked' : ''}>`)
        .join('')}
    </div>`;

  it.each(['light', 'dark', 'system'] as const)('counts a radio group once, as its checked radio (%s)', (checked) => {
    expect(ids(focusableWithin(mount(themeGroup(checked))))).toEqual(['close', 'link', checked]);
  });

  it('counts the first radio of a group with none checked', () => {
    expect(ids(focusableWithin(mount(themeGroup(null))))).toEqual(['close', 'link', 'light']);
  });

  it('keeps separate groups and unnamed radios apart', () => {
    const container = mount(`
      <input id="a1" type="radio" name="a"><input id="a2" type="radio" name="a" checked>
      <input id="b1" type="radio" name="b">
      <input id="u1" type="radio"><input id="u2" type="radio">`);
    expect(ids(focusableWithin(container))).toEqual(['a2', 'b1', 'u1', 'u2']);
  });

  it('treats radios with the same name in different forms as different groups', () => {
    const container = mount(`
      <form><input id="f1" type="radio" name="x" checked></form>
      <form><input id="f2" type="radio" name="x"></form>`);
    expect(ids(focusableWithin(container))).toEqual(['f1', 'f2']);
  });

  it('still skips hidden, inert, aria-hidden and negative tabindex elements', () => {
    const container = mount(`
      <button id="ok">OK</button>
      <div hidden><button id="h">Hidden</button></div>
      <div inert><button id="i">Inert</button></div>
      <button id="ah" aria-hidden="true">Aria hidden</button>
      <button id="neg" tabindex="-1">Out of order</button>`);
    expect(ids(focusableWithin(container))).toEqual(['ok']);
  });
});
