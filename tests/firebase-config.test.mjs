import test from 'node:test';
import assert from 'node:assert/strict';
import {firebaseConfig} from '../assets/js/firebase-config.js';

test('o aplicativo usa Firebase SEDUC independente do SISDIFI',()=>{
  assert.equal(firebaseConfig.projectId,'seduc-especialistas');
  assert.equal(firebaseConfig.authDomain,'seduc-especialistas.firebaseapp.com');
  assert.equal(firebaseConfig.storageBucket,'seduc-especialistas.firebasestorage.app');
  assert.equal(firebaseConfig.messagingSenderId,'1971251228');
  assert.ok(firebaseConfig.appId.startsWith('1:1971251228:web:'));
  assert.match(firebaseConfig.apiKey,/^AIza[0-9A-Za-z_-]+$/);
  assert.ok(!Object.values(firebaseConfig).some(value=>!value||String(value)==='CONFIGURAR'));
});
