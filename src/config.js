var u = require('utils');

module.exports = {
    
    updateConfig() {
	var newVersion = 27;
	if(Memory.configVer != newVersion) {
	    Memory.configVer = newVersion;
	    console.log('Apply Config - ' + newVersion);
	    setConfig()
	}
    },
};

var initMemVars = function() {
    if(!Memory.next_id)
	Memory.next_id = 1;
    // job
//    if(!Memory.job_by_id)
    Memory.job_by_id = {};
    Memory.jobs_del=[];

    //    if(!Memory.job_by_pri)
    {
	Memory.job_by_pri = {};
	u.vTable['CPriorityQ'].cons(Memory.job_by_pri, 'job_by_id', 'CPriorityQ');
    }

    //    if(!Memory.job_by_tgt)
    {
	Memory.job_by_tgt = {};
	u.vTable['CTargetQ'].cons(Memory.job_by_tgt, 'job_by_id', 'CTargetQ');
    }

    // wrk
    /*
    if(!Memory.wrk_by_id)
	Memory.wrk_by_id = {};

    if(!Memory.wrk_by_role)
	Memory.wrk_by_role = new CRoleQ(Memory.wrk_by_id);

    if(!Memory.wrk_by_creep_id)
	Memory.wrk_by_creep_id = new CCreepIdQ(Memory.wrk_by_id);
    */
};


function initRoomVars(name) {
        if(!Memory.rooms[name].NZ)
	    Memory.rooms[name].NZ = 0;

}

function setConfig() {
    
    initMemVars();
    
    var carryBody = [ CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE];
    var archerBody = [ RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, MOVE, MOVE, MOVE, MOVE, TOUGH, TOUGH, TOUGH];
    
    Memory.rooms['E9S8'].strategy_data =[
	{ role : 'harvester', count : 3, body : carryBody}
	,  { role_id : 'h5', role : 'harv', count : 2, body : [ WORK, WORK, WORK, CARRY, WORK, MOVE]
	     , props : { src : '55c34a6b5be41a0a6e80bd5d', tgt: '55d37aec137951da224e8ae7'}}
	, { role_id : 'h4', role : 'harv', count : 2, body : [ WORK, WORK, WORK, MOVE]
	    , props : { src : '55c34a6b5be41a0a6e80bd5b' }}
	, { role_id : 'c3', role : 'carry', count : 2, body : carryBody
	    , props : { f_from : 'f1', tgt: '55d37aec137951da224e8ae7'}}

	// defence
	, { role_id : 'a5', role : 'archer', count : 1, body : archerBody
	    , props : { isMilitary:1,  pos_to : { x : 8, y : 6, d : 0}, stay_put:1 }}

	, { role_id : 'a4', role : 'archer', count : 1, body : archerBody
	    , props : { isMilitary:1,  pos_to : { x : 2, y : 19, d : 0} }}

	, { role_id : 'free', role : 'archer', count : 1, body : archerBody
	    , props : { isMilitary:1 }
	    , autoExpand: 1}
	
	
	// , { role_id : 't1', role : 'testtgt', count : 1, body : [ MOVE ]
	// 	, props : { isMilitary:1,  pos_to : { x : 16, y : 45, d : 0} }}
	
	, { role_id : 'c1', role : 'workonly', count : 1, body : [ WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, CARRY, CARRY, MOVE, MOVE]
	    , props : { tgt : '55c34a6b5be41a0a6e80bd5c', f_from : 'stay_put'} }

	, { role : 'builder', count : 8, body : [ WORK, WORK, WORK, WORK, WORK, CARRY, CARRY, CARRY, CARRY, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE]
	    , props : { is_consumer: 1 } }
	, { role_id : 'c4', role : 'carry', count : 3, body : carryBody
	    , props : { f_from : 'res1',
			pos_to : { x : 21, y : 22, d : 0},
			is_consumer: 1 } }
    ];

    Memory.rooms['E9S8'].strategy = 'str_maintain_creeps';
    initRoomVars('E9S8');

    Memory.rooms['E9S9'].strategy_data = [];
    Memory.rooms['E9S9'].strategy = 'str_maintain_creeps';
    initRoomVars('E9S9');

    Memory.myrooms = {};
    Memory.myrooms['g1'] = {};
    Memory.myrooms['g1'].strategy_data = [
	{ role_id : 'h6', role : 'harv', count : 1, body : [ WORK, WORK, WORK, WORK, WORK, MOVE, MOVE, MOVE]
	    , props : { src : '55c34a6b5be41a0a6e80c19f', rm: 'g1' }}

	, { role_id : 'c6', role : 'carry', count : 4, body : carryBody, props : { f_from : 'f2', tgt: '55d37aec137951da224e8ae7', rm: 'g1'}}

	, { role_id : 'h7', role : 'harv', count : 2, body : [ WORK, WORK, WORK, WORK, WORK, MOVE, MOVE, MOVE]
	    , props : { src : '55c34a6b5be41a0a6e80c1a0', rm: 'g1' }}
	
	, { role_id : 'c7', role : 'carry', count : 2, body : carryBody, props : { f_from : 'f3',
										   pos_to : { x : 22, y : 8, d : 1},
										   rm: 'g1'} }
	
    ];

    Memory.myrooms['g1'].strategy = 'str_maintain_creeps';
    Memory.myrooms['g1'].spawnIn = 'E9S8';

    if(!Memory.myrooms['g1'].NZ)
	Memory.myrooms['g1'].NZ = 0;

    if(!Memory.next_creep_id)
	Memory.next_creep_id = 1;
    
};
