var harvester = require('harvest');
var cr = require('cr');
var myroom = require('myroom');
var u = require('utils');

u.init();

Memory.rooms['E9S8'].strategy_data =[
    { role : 'harvester', count : 3, body : [ CARRY, CARRY, MOVE, MOVE, MOVE, MOVE]}
    ,  { role_id : 'h5', role : 'harv', count : 2, body : [ WORK, WORK, WORK, CARRY, WORK, MOVE]
	 , props : { src : '55c34a6b5be41a0a6e80bd5d', tgt: '55d37aec137951da224e8ae7'}}
    , { role_id : 'h4', role : 'harv', count : 2, body : [ WORK, WORK, WORK, MOVE]
	, props : { src : '55c34a6b5be41a0a6e80bd5b' }}

    , { role_id : 'h6', role : 'harv', count : 1, body : [ WORK, WORK, WORK, MOVE]
	, props : { src : '55c34a6b5be41a0a6e80c19f' }}

    , { role_id : 'c6', role : 'carry', count : 4, body : [ CARRY, CARRY, CARRY, MOVE, MOVE, MOVE, MOVE]
	, props : { f_from : 'f2', tgt: '55d37aec137951da224e8ae7'}}    

    // , { role_id : 't1', role : 'testtgt', count : 1, body : [ MOVE ]
    // 	, props : { isMilitary:1,  pos_to : { x : 16, y : 45, d : 0} }}
    
    , { role_id : 'a5', role : 'archer', count : 1, body : [ RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, MOVE]
	, props : { isMilitary:1,  pos_to : { x : 8, y : 6, d : 0}, stay_put:1 }}

    , { role_id : 'a4', role : 'archer', count : 1, body : [ RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, MOVE]
	, props : { isMilitary:1,  pos_to : { x : 2, y : 19, d : 0} }}

    , { role_id : 'free', role : 'archer', count : 2, body : [ RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, MOVE]
	, props : { isMilitary:1 }}
    
    , { role_id : 'c1', role : 'workonly', count : 0, body : [ WORK, WORK, WORK, WORK, WORK, WORK, CARRY, CARRY, MOVE, MOVE]
	, props : { tgt : '55c34a6b5be41a0a6e80bd5c', f_from : 'stay_put'} }

    , { role : 'builder', count : 7, body : [ WORK, WORK, WORK, CARRY, CARRY, CARRY, CARRY, MOVE, MOVE, MOVE, MOVE]
	, props : { is_consumer: 1 } }
    , { role_id : 'c3', role : 'carry', count : 4, body : [ CARRY, CARRY, CARRY, MOVE, MOVE, MOVE, MOVE]
	, props : { f_from : 'f1', tgt: '55d37aec137951da224e8ae7'}}
    , { role_id : 'c4', role : 'carry', count : 0, body : [ CARRY, CARRY, CARRY, CARRY, MOVE, MOVE, MOVE, MOVE, MOVE ]
	, props : { f_from : 'res1',
		    pos_to : { x : 21, y : 22, d : 0},
		    is_consumer: 1 } }

    
];

if(!Memory.next_creep_id)
    Memory.next_creep_id = 1;

//u.init();

myroom();

for(var name in Game.creeps) {
    var creep = Game.creeps[name];

    if(creep.memory.role == 'harvester') {
	u.crstr_do_harvest(creep);
	// harvester(creep);
    }

    else if(creep.memory.role == 'workonly') {
	u.crstr_do_workonly(creep);
	// harvester(creep);
    }    

    else if(creep.memory.role == 'harv') {
	u.crstr_do_harv(creep);
    }

    else if(creep.memory.role == 'carry') {
	u.crstr_do_carry(creep);
    }

    else if(creep.memory.role == 'archer') {
	u.crstr_do_archer(creep);
    }    

    if(creep.memory.role == 'cr') {
	u.crstr_do_control(creep);
    }

    if(creep.memory.role == 'builder') {
	u.crstr_do_build(creep);
    }

    if(creep.memory.role == 'testtgt') {
	u.crstr_do_testtgt(creep);
    }    
    
    if(creep.memory.role == 'guard') {
	var targets = creep.room.find(FIND_HOSTILE_CREEPS);
	if(targets.length) {
	    creep.moveTo(targets[0]);
	    creep.attack(targets[0]);
	}
    }
}
