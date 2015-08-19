var harvester = require('harvest');
var cr = require('cr');
var myroom = require('myroom');
var u = require('utils');
var config = require('config');

u.init();
config.updateConfig();

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
