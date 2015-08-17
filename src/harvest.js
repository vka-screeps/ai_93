module.exports = function (creep) {

    if(creep.carry.energy < creep.carryCapacity) {
	var target = creep.pos.findClosest(FIND_SOURCES);
	creep.moveTo(target);
	creep.harvest(target);
    }
    else {
	creep.moveTo(Game.spawns.Sp1);
	creep.transferEnergy(Game.spawns.Sp1)
    }
}
