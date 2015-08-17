module.exports = {
    stat : function() { printStat_(); },
    clear : function() { clearMemory_(); }
};


printStat_ = function() {
    for(var ri in Game.rooms) {
	var rm = Game.rooms[ri];
	console.log ('ROOM: ' + rm.name);
	console.log ('energyAvailable/: ' + rm.energyAvailable + ' / ' + rm.energyCapacityAvailable);
	var el = rm.find(FIND_DROPPED_ENERGY);
	var esum = 0;
	for(var i in el) {
	    var e = el[i];
	    esum = esum + e.energy
	}
	console.log('energy dropped: ' + esum + ', ' + rm.memory.energyDropped + ', ' + rm.memory.buildersBallance +' / ' +  rm.memory.buildersBallanceOrig
		   + ' / ' + rm.memory.buildersWaiting);
    }
};


clearMemory_ = function() {
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
