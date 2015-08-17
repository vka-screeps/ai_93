var harvester = require('harvest');
var cr = require('cr');
var myroom = require('myroom');
var u = require('utils');


Memory.rooms['E9S8'].strategy_data =[
    { role : 'harvester', count : 3, body : [ CARRY, CARRY, MOVE, MOVE, MOVE, MOVE]}
    ,  { role_id : 'h3', role : 'harv', count : 2, body : [ WORK, WORK, WORK, WORK, MOVE]
	 , props : { src : '55c34a6b5be41a0a6e80bd5d', role : 'harv', role_id : 'h3'}}
    , { role_id : 'h4', role : 'harv', count : 2, body : [ WORK, WORK, WORK, MOVE]
	, props : { src : '55c34a6b5be41a0a6e80bd5b', role : 'harv', role_id : 'h4'}}

    , { role_id : 'c1', role : 'workonly', count : 1, body : [ WORK, WORK, WORK, WORK, WORK, WORK, CARRY, CARRY, MOVE, MOVE]
	, props : { tgt : '55c34a6b5be41a0a6e80bd5c', f_from : 'stay_put'} }

    , { role : 'builder', count : 5, body : [ WORK, WORK, CARRY, CARRY, CARRY, CARRY, MOVE, MOVE, MOVE, MOVE]
	, props : { is_consumer: 1 } }
    , { role_id : 'c3', role : 'carry', count : 4, body : [ CARRY, CARRY, CARRY, MOVE, MOVE, MOVE, MOVE]
	, props : { f_from : 'f1',
		    pos_to : { x : 8, y : 28, d : 3}}}
    , { role_id : 'c4', role : 'carry', count : 4, body : [ CARRY, CARRY, CARRY, CARRY, MOVE, MOVE, MOVE, MOVE, MOVE ]
	, props : { f_from : 'res1',
		    pos_to : { x : 21, y : 22, d : 0},
		    is_consumer: 1 } } 
];

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

    if(creep.memory.role == 'cr') {
	u.crstr_do_control(creep);
    }

    if(creep.memory.role == 'builder') {
	u.crstr_do_build(creep);
    }

    if(creep.memory.role == 'guard') {
	var targets = creep.room.find(FIND_HOSTILE_CREEPS);
	if(targets.length) {
	    creep.moveTo(targets[0]);
	    creep.attack(targets[0]);
	}
    }
}
