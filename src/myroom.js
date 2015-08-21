var u = require('utils');

module.exports = function () {

    for(var name in Game.rooms) {
	// console.log('room');
	u.log('room1');
	var room = Game.rooms[name];
	var room_data = Memory.rooms[name]

	if(!room_data || !room_data.strategy)
	    continue;

	// energy dropped
	var res_flag = room.find(FIND_FLAGS, { filter: function(o) { return o.name.substring(0,3) == 'res'; } } )[0];
	var res_pos=null;
	var esum = 0;
	
	if(res_flag) {
	    res_pos = res_flag.pos;
	    
	    var el = room.find(FIND_DROPPED_ENERGY, { filter: function(o) { return o.energy>50 && ( !res_pos || res_pos.getRangeTo(o.pos)<10 ) } });
	    for(var i in el) {
		var e = el[i];
		esum = esum + e.energy
	    }
	}

	var el = room.find(FIND_MY_STRUCTURES,
			 {filter: function(o) { return o.structureType==STRUCTURE_STORAGE } } );

	var storeCapacity = 0;
	for(var i in el) {
	    var e = el[i];
	    esum = esum + e.store.energy
	    storeCapacity += e.storeCapacity;
	    // Accumulate energy
	    room_data.NZ++;
	}

	// Can't accumulate more then storeCapacity * 0.9
	if(room_data.NZ > storeCapacity * 9 / 10)
	    room_data.NZ = storeCapacity * 9 / 10;

	room_data.energyDropped = esum;
	room_data.buildersBallance = esum + 2*room.energyAvailable - room.energyCapacityAvailable * 3 - room_data.NZ;
	room_data.buildersBallanceOrig = room_data.buildersBallance;
	room_data.buildersWaiting = 0;

	var hostiles = room.find(FIND_HOSTILE_CREEPS);
	room_data.hostiles = hostiles ? hostiles.length : 0;

	if(!room_data.maxHostiles)
	    room_data.maxHostiles = 0;
	if(room_data.hostiles > room_data.maxHostiles)
	    room_data.maxHostiles = room_data.hostiles;
	
	u.str_plan_work(room);

	if(room_data && room_data.strategy)
	    u[room_data.strategy](room_data.strategy_data, room);
    }

    if(Memory.myrooms) {
	var name = 'g1';
	room_data = Memory.myrooms[name]
	if(room_data && room_data.strategy)
	    u[room_data.strategy](room_data.strategy_data, Game.rooms[room_data.spawnIn], name);
    }
}

