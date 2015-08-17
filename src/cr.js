module.exports = function (creep) {

    var loading = (creep.carry.energy == 0 || creep.step=='loading');
		   
    if(loading) {
	creep.moveTo(Game.spawns.Sp1);
	Game.spawns.Sp1.transferEnergy(creep);
	if(creep.carry.energy < creep.carryCapacity)
	{
	    creep.step='loading';
	}
	else
	{
	    creep.step='working';
	    creep.say('working');
	}
    }
    else {
	var target = creep.room.controller;
	creep.moveTo(target);
	creep.upgradeController(target);

	if(creep.carry.energy == 0)
	    creep.step='loading';
    }
}
