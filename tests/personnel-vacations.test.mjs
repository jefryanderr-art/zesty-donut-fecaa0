import test from 'node:test';
import assert from 'node:assert/strict';
import {vacationBalance} from '../netlify/lib/personnel.mjs';
test('vacaciones separan solicitudes pendientes, aprobaciones e histórico',()=>{
 const data={businessRecords:[{module:'vacaciones_personal',kind:'request',employeeId:'e',status:'Pendiente',days:7},{module:'vacaciones_personal',kind:'request',employeeId:'e',status:'Aprobada',days:3}]};
 assert.deepEqual(vacationBalance(data,{id:'e',start:'2025-01-01',salary:300,vacationsUsed:2},{vacationDays:12,daysPerYear:365,daysPerMonth:30},'2026-01-01'),{earned:12,used:5,balance:7,liabilityCents:7000});
});
