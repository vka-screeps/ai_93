module.exports = {
    stat : function() { printStat_(); },
    work :  function() { printWork_(); },
    jobs :  function() { sayJobs(); },
    clear : function() { clearMemory_(); }
};

var _ = require('lodash');

var printStat_ = function() {
    var totalCreeps = 0;
    var totalCreepParts = 0;

    var creepCosts = {};
    creepCosts[MOVE] =  50;
    creepCosts[WORK] =  100;
    creepCosts[CARRY] =  50;
    creepCosts[ATTACK] =  80;
    creepCosts[RANGED_ATTACK ] =  150;
    creepCosts[HEAL] =  250;
    creepCosts[TOUGH] =  10;
    
    for(var ri in Game.rooms) {
	var rm = Game.rooms[ri];
	console.log ('ROOM: ' + rm.name);
	//	console.log ('energyAvailable: ' + rm.energyAvailable + ' / ' + rm.energyCapacityAvailable);

	let esum = _.reduce(rm.find(FIND_DROPPED_ENERGY),
			    function (sum, n) {return sum+n.energy;},
			    0 );

	console.log('energy dropped: ' + esum );

	var creeps = rm.find(FIND_MY_CREEPS);	
	var roles = [];
	for(var ic in  creeps)
	{
	    var c = creeps[ic];
	    var cr = c.memory.role + (c.memory.role_id ? '_'+c.memory.role_id : '');
	    // console.log( 'found ' + c.name + ' : ' + cr );
	    if(!roles[cr])
		roles[cr] = [c];
	    else
		roles[cr].push(c);

	    totalCreeps++;
	    for(var pi in c.body) {
		var partCost = creepCosts[c.body[pi].type];
		if(isNaN(partCost))
		    console.log(c.body[pi].type + ' - ' + partCost);
		else
		    totalCreepParts += partCost;
	    }
	}

	for(var ic in roles) {
	    var rl = roles[ic];
	    var str = ' ' + ic + ' : ';

	    for(var iic in rl) {
		str += rl[iic].name + ' ';
	    }

	    console.log(str);
	}

	console.log('Hostiles: ' + rm.memory.hostiles + ' / ' + rm.memory.maxHostiles);
	console.log('NZ: ' + rm.memory.NZ);
    }

    console.log('Total creeps: ' + totalCreeps + ' / ' + totalCreepParts);
};


var clearMemory_ = function() {
    var names = [];
    
    for(var ri in Game.rooms) {
	var rm = Game.rooms[ri];
	var creeps = rm.find(FIND_MY_CREEPS)
	for(var ci in creeps ) {
	    names[creeps[ci].name] = 1;
	}
    }

    var total = 0;
    var cleared = 0;
    for(var mi in Memory.creeps) {
	++total;
	if(!names[mi] ) {
	    ++cleared;
	    delete Memory.creeps[mi];
	}
    }

    console.log('cleared ' + cleared + ' of ' + total);
};

var printWork_ = function() {
    
    for(var ri in Game.rooms) {
	var rm = Game.rooms[ri];
	if(rm.memory.jobs) {
	    
	    console.log ('ROOM: ' + rm.name);
	    for(let hp_id in rm.memory.harvPoints) {
		let hp = f.make(rm.memory.harvPoints[hp_id], null);
	    }

	    console.log('energy dropped: ' + esum + ', ' + rm.memory.energyDropped + ', ' + rm.memory.buildersBallance +' / ' +  rm.memory.buildersBallanceOrig
			+ ' / ' + rm.memory.buildersWaiting);

	    var creeps = rm.find(FIND_MY_CREEPS);	
	    var roles = [];
	    for(var ic in  creeps)
	    {
		var c = creeps[ic];
		var cr = c.memory.role + (c.memory.role_id ? '_'+c.memory.role_id : '');
		// console.log( 'found ' + c.name + ' : ' + cr );
		if(!roles[cr])
		    roles[cr] = [c];
		else
		    roles[cr].push(c);

		totalCreeps++;
		for(var pi in c.body) {
		    var partCost = creepCosts[c.body[pi].type];
		    if(isNaN(partCost))
			console.log(c.body[pi].type + ' - ' + partCost);
		    else
			totalCreepParts += partCost;
		}
	    }

	    for(var ic in roles) {
		var rl = roles[ic];
		var str = ' ' + ic + ' : ';

		for(var iic in rl) {
		    str += rl[iic].name + ' ';
		}

		console.log(str);
	    }

	    console.log('Hostiles: ' + rm.memory.hostiles + ' / ' + rm.memory.maxHostiles);
	    console.log('NZ: ' + rm.memory.NZ);
	}
    }

    console.log('Total creeps: ' + totalCreeps + ' / ' + totalCreepParts);
};

var sayJobs = function() {
    for(let i in Game.creeps) {
	let cr = Game.creeps[i];
	try {
	    let txt = cr.memory.role.job_id;
	    if(txt) {
		cr.say(txt);
	    }
	} catch(err) {};
    }
};
