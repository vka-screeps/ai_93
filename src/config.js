var u = require('utils');
var configver = require('configver');

module.exports = {
    

    updateConfig() {
	var newVersion = configver.configVersion;
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
};


function initRoomVars(name) {
        if(!Memory.rooms[name].NZ)
	    Memory.rooms[name].NZ = 0;

}


function setConfig() {

    if( Game.rooms.sim && !Game.rooms.E9S8 ) {
	console.log("Sim mode detected!");
	return setConfigSim();
    }

    initMemVars();
    
    var carryBody = [ CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE];
    // var carryBody = [ CARRY, CARRY, CARRY, CARRY, MOVE, MOVE];
    var archerBody = [ RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, MOVE, MOVE, MOVE, MOVE, TOUGH, TOUGH, TOUGH];
//    var harv1rBody = [ WORK, WORK, WORK, WORK, WORK, WORK, WORK, CARRY, CARRY, MOVE, MOVE];
    
    Memory.rooms['E9S8'].strategy_data =[
	/*
	// { role_id : 'h0', role : 'harvester', count : 1, body : [CARRY, CARRY, MOVE, MOVE]},
	{ role : 'harvester', count : 3, body : carryBody}
	,  { role_id : 'h5', role : 'harv', count : 1, body : [ WORK, WORK, WORK, WORK, WORK, WORK, WORK, CARRY, CARRY, MOVE, MOVE]
	     , props : { src : '55c34a6b5be41a0a6e80bd5d', tgt: '55d37aec137951da224e8ae7'}}

	, { role_id : 'h4', role : 'harv', count : 1, body :  [ WORK, WORK, WORK, WORK, WORK, WORK, WORK, MOVE, MOVE, MOVE, MOVE, MOVE]
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
	
	, { role_id : 'c1', role : 'workonly', count : 1, body : [ WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, CARRY, CARRY, CARRY, MOVE, MOVE, MOVE]
	    , props : { tgt : '55c34a6b5be41a0a6e80bd5c', f_from : 'stay_put'} }

	, { role : 'builder', count : 5, body : [ WORK, WORK, WORK, WORK, WORK, WORK, CARRY, CARRY, CARRY, CARRY, CARRY, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE]
	    , props : { is_consumer: 1 } }
	, { role_id : 'c4', role : 'carry', count : 3, body : carryBody
	    , props : { f_from : 'res1',
			pos_to : { x : 21, y : 22, d : 0},
			is_consumer: 1 } }
	*/

    ];

    Memory.rooms['E9S8'].strategy = 'str_maintain_creeps';
    initRoomVars('E9S8');

    Memory.rooms['E9S9'].strategy_data = [];
    Memory.rooms['E9S9'].strategy = 'str_maintain_creeps';
    initRoomVars('E9S9');

    Memory.myrooms = {};
    Memory.myrooms['g1'] = {};
    Memory.myrooms['g1'].strategy_data = [
	/*
	{ role_id : 'h6', role : 'harv', count : 1, body : [ WORK, WORK, WORK, WORK, WORK, MOVE, MOVE, MOVE]
	    , props : { src : '55c34a6b5be41a0a6e80c19f', rm: 'g1' }}

	, { role_id : 'c6', role : 'carry', count : 4, body : carryBody, props : { f_from : 'f2', tgt: '55d37aec137951da224e8ae7', rm: 'g1'}}

	, { role_id : 'h7', role : 'harv', count : 2, body : [ WORK, WORK, WORK, WORK, WORK, MOVE, MOVE, MOVE]
	    , props : { src : '55c34a6b5be41a0a6e80c1a0', rm: 'g1' }}
	
	, { role_id : 'c7', role : 'carry', count : 2, body : carryBody, props : { f_from : 'f3',
										   pos_to : { x : 22, y : 8, d : 1},
										   rm: 'g1'} }

	*/
    ];

    Memory.myrooms['g1'].strategy = 'str_maintain_creeps';
    Memory.myrooms['g1'].spawnIn = 'E9S8';

    if(!Memory.myrooms['g1'].NZ)
	Memory.myrooms['g1'].NZ = 0;

    if(!Memory.next_creep_id)
	Memory.next_creep_id = 1;
};


function setConfigSim() {
    initMemVars();
    
    var carryBody = [ CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE];
    var archerBody = [ TOUGH, RANGED_ATTACK, MOVE, MOVE];
    


    Memory.rooms['sim'] = {};
    // SIM CONFIG
    Memory.rooms['sim'].balance = {
	h1: {id:'h1', count: 1, curCount: 0, design: 'd_h1', role: 'JobMiner' },
	c1: {id:'c1', count: 1, curCount: 0, design: 'd_c1', role: 'JobCarrier' },
	d1: {id:'d1', count: 2, curCount: 0, design: 'd_def1', role: 'JobDefender' },
	b1: {id:'b1', count: 0, curCount: 0, design: 'd_b1', role: 'JobBuilder' },

//	d2: {id:'d2', count: 1, curCount: 0, design: 'd_def1', role: 'JobDefender' },
    };

    Memory.rooms['sim'].jobs = {
	'JobMiner' : { 'j1': { id : 'j1',
			       cname: 'JobMinerBasic',
			       taken_by_id: null,
			       priority : 0,
			       res_id: null,
			       res_pos : {x: 35, y: 20},
			       drop_id: null,
			       drop_name: 'Spawn1',
			     },
		       'j2': { id : 'j2',
			       cname: 'JobMiner',
			       taken_by_id: null,
			       priority : 1,
			       res_id: null,
			       res_pos : {x: 35, y: 20},
			     }
		     },
	'JobCarrier' : { 'jc1' : { id : 'jc1',
				   cname: 'JobCarrier',
				   taken_by_id: null,
				   priority : 0,

				   take_from :  { cname: 'AddrHarvester',
						  x: 35,
						  y: 20,
						  full: true },
				   take_to : { cname: 'AddrBuilding',
					       spawnName: 'Spawn1', },
				 },
			 
		       },
	'JobDefender' : { 'jd1': { id: 'jd1',
				   cname: 'JobDefender',
				   taken_by_id: null,
				   priority : 0,
				   def_pos : {cname: 'AddrPos',
					      x: 27,
					      y: 25 },
				 },
			  'jd2': { id: 'jd2',
				   cname: 'JobDefender',
				   taken_by_id: null,
				   priority : 0,
				   def_pos : {cname: 'AddrPos',
					      x: 27,
					      y: 25 },
				 },
			  'jd3': { id: 'jd3',
				   cname: 'JobDefender',
				   taken_by_id: null,
				   priority : 0,
				   def_pos : {cname: 'AddrPos',
					      x: 27,
					      y: 25 },
				 },
			},
	'JobBuilder' : {},

    };

    Memory.rooms['sim'].creeplist = {};
    Memory.rooms['sim'].recoveryMode = true;

    /*
    Memory.rooms['sim'].strategy_data =[
	{ role_id : 'h1', role : 'harvester', count : 1, body : [ WORK, WORK, CARRY, MOVE], props: {goHarvest: 1} }
	,{ role_id : 'h2', role : 'harvester', count : 1, body : [ WORK, WORK, CARRY, MOVE], props: {goHarvest: 1} }	
	, { role_id : 'free', role : 'guard', count : 1, body : [TOUGH, TOUGH, ATTACK, ATTACK, MOVE]
	    , props : { isMilitary:1 }
	    , autoExpand: 1}
	,{ role_id : 'h3', role : 'harv', count : 1, body : [ WORK, WORK, MOVE] }
    ];

    Memory.rooms['sim'].strategy = 'str_maintain_creeps';
    Memory.rooms['sim'].str_data = {	curRoleTable : [],
					curGoals : {},
					specialization : "growth"
				   };
    */
    initRoomVars('sim');
    

    if(!Memory.next_creep_id)
	Memory.next_creep_id = 1;
}

