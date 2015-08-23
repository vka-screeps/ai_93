var glb = require('glb');

module.exports = {

    vTable : {},


    init : function() {
    },

    log : function(str) {
	if(Memory.glb_mode==2)
	    console.log('mylog: ' + str);
    },

    printObject : function(o) {
	/*
	var out = '{';
	for (var p in o) {
	    out += p + ': ' + o[p] + '\n';
	}
	out += '}';
	console.log(out);
	*/
	print_r(o);
    },

    str_maintain_creeps : function(lst, rm, rm_name)
    {
	var isGlobal = true;
	if(!rm_name) {
	    rm_name = rm.name;
	    isGlobal = false;
	}

	if(!glb.rooms[rm_name])
	    glb.rooms[rm_name] = {roles:[]};
	
	var roles = glb.rooms[rm_name].roles;
	var created = 0;
	var spawning = 0;

	var lst_by_id = {};
	for(var i in lst)
	{
	    var it = lst[i];
	    var it_name = genNamePrefix(it);
	    lst_by_id[it_name] = it;
	}	

	if(!isGlobal) {
	    var creeps = rm.find(FIND_MY_CREEPS);
	    for(var ic in  creeps)
	    {
		var c = creeps[ic];
		var cr = genNamePrefix(c.memory);

		// May be generte a new job?
		/*
		if(c.ticksToLive < 50) {
		    if(lst_by_id[cr]) {
			addJobNewCreep( c.memory.rm ? c.memory.rm : rm_name, lst_by_id[cr], c );
		    }
		}
		*/
		
		if(c.memory.rm && c.memory.rm != rm_name) {
		    if(!glb.rooms[c.memory.rm])
			glb.rooms[c.memory.rm] = {roles:[]};
		    if(!glb.rooms[c.memory.rm].roles[cr])
			glb.rooms[c.memory.rm].roles[cr] = {creeps:[c]};
		    else
			glb.rooms[c.memory.rm].roles[cr].creeps.push(c);
		} else {
		    if(!roles[cr])
			roles[cr] = {creeps:[c]};
		    else
			roles[cr].creeps.push(c);
		}
	    }
	}

	for(var i in lst)
	{
	    var it = lst[i];

	    var it_name = genNamePrefix(it);

	    if(it.props && it.props.rm && it.props.rm != rm_name) {
		console.log("not my room - " + it.props.rm + ' - ' + it_name);
		continue;
	    }

	    if(!roles[it_name])
		roles[it_name] = {creeps:[]};
	    //	    printObjectFnc(lst[it]);
	    //	    console.log('role: ' + it['role']);

	    // var it_name = it.role + (it.role_id ? it.role_id : '');

	    var curCount = 0;
	    if(roles[it_name] && roles[it_name].del) {
		console.log('duplicate ' + it_name);
		continue;
	    }

	    curCount = roles[it_name] ? roles[it_name].creeps.length : 0;

	    // console.log(it.role + ', ' + it.count + ', ' + curCount);
	    var autoExpand = 0;
	    if(!isGlobal)
		autoExpand = it.autoExpand ? (rm.memory.hostiles * 3 / 2) : 0;

	    /*
	    if(isGlobal) {
//		console.log(it_name + ' ' + (it.count + autoExpand) + ', ' + curCount);

		if(it_name == 'harv_h6') {
		    console.log('harv_h6 - ' + roles[it_name].creeps[0] );
		}
	    }
	    */
	    
	    if( (it.count + autoExpand) > curCount )
	    {
		roles[it_name].del = 1;

		if(rm.find(FIND_MY_SPAWNS)[0].spawning || created)
		    continue;

		var props = it.props ? it.props : { };
		props.role = it.role;
		if(it.role_id)
		    props.role_id = it.role_id;

		var newName = rm.find(FIND_MY_SPAWNS)[0].createCreep( it.body, genNamePrefix(props, Memory.next_creep_id++), props );
		if(newName != -6)
		    console.log('spawning ' + ' - ' + newName);

		// if(props.rm && "string" ==  typeof newName) {
		//     Game.creeps[newName].memory.rm = props.rm;
		// }
		
		created = 1;
		//break;
	    }
	    else if( it.count < curCount )
	    {
		if(!roles[it_name].creeps[0].memory.isMilitary) {
		    /*
		    console.log('killing ' + it_name);
		    roles[it_name].creeps[0].suicide();
		    */
		}
	    }
	    roles[it_name].del = 1;

	}

	for(var j in roles) {
	    var jit = roles[j];

	    if(jit && jit.del) {
		continue;
	    }
	    // this role_id is no longer in use
	    if(jit) {
		if(!jit.creeps[0].memory.isMilitary) {
		    console.log('killing ' + jit.creeps[0].memory.role);
		    jit.creeps[0].suicide();
		}
	    }
	}

	// May be take a job?
	var sp = rm.find(FIND_MY_SPAWNS)[0];
	if(sp) {
	    if(!sp.spawning && !created){

		var job = getNextJobForSpawn(sp);
		if(job) {
		    console.log('got new job - ' + job.id);
		    var it = job.p.it;

		    var props = it.props ? it.props : { };
		    props.role = it.role;
		    if(it.role_id)
			props.role_id = it.role_id;
		    
		    var newName = rm.find(FIND_MY_SPAWNS)[0].createCreep( it.body, genNamePrefix(props, Memory.next_creep_id++), props );
		    if(newName != -6)
			console.log('spawning ' + ' - ' + newName);

		}
	    }
	}
	return created;
    },

    // room.memory.work [{target, wieght, count}]
    str_plan_work : function(rm) {
	rm.memory.work=[];
	rm.memory.work_by_id = [];

	var targets = null;
	var maxLen = 1000;

	targets = rm.find(FIND_STRUCTURES, {filter: function(o) {
	    return (o.structureType!=STRUCTURE_CONTROLLER) &&
		( (o.structureType==STRUCTURE_WALL)||(o.structureType==STRUCTURE_ROAD) || (o.owner && o.owner.username=='ai_93') ); } } );
			  
	for(var ti in targets) {
	    var tgt = targets[ti];
	    var w = 100;
	    var c = 1;

	    var logit = 0;

	    if(tgt.hitsMax == 1)
		continue;

	    if(tgt.hits && tgt.hits > (tgt.hitsMax * 8 / 10))
		continue;

	    if(tgt.hits < 300 && tgt.hits<tgt.hitsMax)
		w = 1;
	    else if((tgt.hits < 2000) && (tgt.hits < (tgt.hitsMax/2)))
		w = 2;
	    else if (tgt.hits<30000 && tgt.hits < tgt.hitsMax/2)
		w = 10 + (tgt.hits * 10 / 30000);
	    else if (tgt.hits<100000 && tgt.hits < tgt.hitsMax/2)
		w = 20 + (tgt.hits * 10 / 100000)
	    else
		w = (30 + tgt.hits * 10 / 1000000);

	    // if(logit)
	    // 	console.log('logit ' + tgt.hits + '/'+tgt.hitsMax+' - '+ w);

	    if(maxLen-- <= 0) {
		console.log('maxLen');
		break;
	    }
	    
	    if(w) {
		w = Math.floor(w);
		rm.memory.work_by_id[tgt.id] = {target:tgt, weight: w, count:c };
		if(!rm.memory.work[w])
		    rm.memory.work[w] = [tgt.id];
		else
		    rm.memory.work[w].push( tgt.id );
	    }
	}

	//console.log('len0 = ' + rm.memory.work.length);

	targets = rm.find(FIND_CONSTRUCTION_SITES);
	for(var ti in targets) {
	    var tgt = targets[ti];
	    var w = 15;
	    var c = 1;
	    if(tgt.progressTotal < 2000)
		w = 5;
	    else
		c = 3;

	    if(maxLen-- <= 0)
		break;

	    if(w) {
		w = Math.floor(w);
		rm.memory.work_by_id[tgt.id] = {target:tgt, weight: w, count:c };
		if(!rm.memory.work[w])
		    rm.memory.work[w] = [tgt.id];
		else
		    rm.memory.work[w].push( tgt.id );
	    }
	}

	// some creeps already have assignments
	var creeps = rm.find( FIND_MY_CREEPS, {filter: function(o) { return o.memory.role == 'builder' ; } } );
	for(var ti in creeps) {
	    var cr = creeps[ti];
	    if( cr.memory.my_target) {
		if (rm.memory.work_by_id[cr.memory.my_target] )
		    rm.memory.work_by_id[cr.memory.my_target].count --;
		else {
		    cr.memory.my_target = null;
		}
	    }
	}
    },

    crstr_do_control : function(cr) {
	return str_do_smth(cr, 
			   function( cr1, rm1 ) { return rm1.controller; },
			   function( cr1, o ) { return cr1.upgradeController(o); } );
    },

    crstr_do_workonly : function(cr) {
	return str_do_smth(cr, 
			   function( cr1, rm1 ) {
			       var target = null;
			       if(cr1.memory.tgt) {
				   target = Game.getObjectById(cr1.memory.tgt);
			       }
			       if(!target)
				   console.log('target not found - ' + cr1.memory.tgt);
			       return target;
			   },

			   function( cr1, o ) {
			       var ret = -1;
			       if(o instanceof ConstructionSite)
				   ret = cr1.build(o);
			       else if(o.structureType==STRUCTURE_CONTROLLER)
				   ret = cr1.upgradeController(o);
			       else // if(o instanceof Structure)
				   ret = cr1.repair(o);

			       // if(ret < 0 && ret != ERR_NOT_IN_RANGE)
			       // {
			       // 	   if( cr1.pos.getRangeTo(o.pos) <2 ) {
			       // 	       cr1.memory.my_target = null;
			       // 	   }
			       // }
			       return ret;
			   } );
    },

    crstr_do_carry : function(cr) {
	return str_do_smth(cr, 
			   function( cr1, rm1 ) { 
			       if(cr1.memory.pos_to)
				   return  rm1.getPositionAt(cr1.memory.pos_to.x, cr1.memory.pos_to.y);
			       else if(cr1.memory.tgt) {
				   var target = null;
				   target = Game.getObjectById(cr1.memory.tgt);
				   if(!target)
				       console.log('target not found');
				   return target;
			       }
			       return null;
			   },
			   function( cr1, o ) {
			       if(cr1.memory.pos_to) {
				   var dist = cr1.memory.pos_to.d ? cr1.memory.pos_to.d : 0;
				   if(cr1.pos.getRangeTo(o.x,o.y) <= dist)
				       cr1.dropEnergy();
			       } else {
				   cr1.transferEnergy(o);
			       }
			   } );
    },

    crstr_do_archer : function(cr) {
	return str_do_smth(cr, 
			   function( cr1, rm1 ) {
			       
			       if(cr1.memory.pos_to && cr1.memory.stay_put)
				   return  rm1.getPositionAt(cr1.memory.pos_to.x, cr1.memory.pos_to.y);
			       else {
				   var target = cr1.pos.findClosestByRange( FIND_HOSTILE_CREEPS
									    //, { filter:function(enemy){enemy.owner.username !== 'Source Keeper'}}
									  );
				   if(!target)
				       target = cr1.pos.findClosestByRange( FIND_MY_CREEPS, {filter: function(o) { return o.memory.role == 'testtgt' && o.memory.ready; } } );
 
				   if(target) {
				       if(cr1.pos.getRangeTo(target.pos) <= 3)
					   return cr1.pos;
				       else
					   return target;
				   }
				   else if(cr1.memory.pos_to)
				       return rm1.getPositionAt(cr1.memory.pos_to.x, cr1.memory.pos_to.y);
			       }
			       return null;
			   },
			   function( cr1, o ) {
			       var target = cr1.pos.findClosestByRange(FIND_HOSTILE_CREEPS
								       //, { filter:function(enemy){enemy.owner.username !== 'Source Keeper'}}
								      );
			       if(!target)
				   target = cr1.pos.findClosestByRange(FIND_MY_CREEPS, {filter: function(o) { return o.memory.role == 'testtgt' && o.memory.ready; } } );
			       
			       if(target) {
				   cr1.say('shooting at ' + target);
				   cr1.rangedAttack(target);
			       }
			   } );
    },

    crstr_do_testtgt : function(cr) {
	return str_do_smth(cr, 
			   function( cr1, rm1 ) {
			       if(cr1.memory.pos_to)
				   return  rm1.getPositionAt(cr1.memory.pos_to.x, cr1.memory.pos_to.y);
			       return null;
			   },
			   function( cr1, o ) {
			       if(cr1.pos.getRangeTo(o) == 0) {
				   cr1.memory.ready = 1;
			       }
			   } );
    },        

    util_get_res_class : function (cr)  {
	if(cr.memory.res_class)
	    return res_class;
	if(cr.memory.role == 'builder')
	    return 'res_builder';
    },

    crstr_do_build : function(cr) {
	return str_do_smth(cr, 
			   function( cr1, rm1 ) { 
			       // room.memory.work [{target, wieght, count}]

			       if(cr1.memory.my_target) {
				   
			           var o1 = Game.getObjectById(cr1.memory.my_target);
				   if(o1) {
				       return o1;
				   }
				   else {
				       cr1.memory.my_target = null;
				   }
			       }
			       
			       var keys = Object.keys(rm1.memory.work);
			       for(wi in keys) {
				   var wrkl = rm1.memory.work[keys[wi]];
				   for(wi2 in wrkl) {
				       var wrk = rm1.memory.work_by_id[wrkl[wi2]];
				       if(wrk.count > 0) {
					   wrk.count--;
					   // TODO - delete element
					   // console.log('take ' + wrk.target + '-' + wrk.weight);
					   console.log(cr1.name + ' takes ' + wrk.target + ', ' + wrk.weight + ', ' + (wrk.target.hits ? wrk.target.hits : 0)  +
						      ' / ' + (wrk.target.hitsMax ? wrk.target.hitsMax : 0));
					   return wrk.target;
				       }
				   }
				   // if(wrkl.length>1)
				   //     console.log('no work at ' + keys[wi] + ' - ' + wrkl.length);
			       }
			       return null;

			   },
			   function( cr1, o ) {
			       // console.log('o is ' + o);
			       var ret = -1;
			       if(o instanceof ConstructionSite)
				   ret = cr1.build(o);
			       else if(o.structureType==STRUCTURE_CONTROLLER)
				       ret = cr1.upgradeController(o);
			       else // if(o instanceof Structure)
				   ret = cr1.repair(o);

			       if(ret < 0 && ret != ERR_NOT_IN_RANGE)
			       {
				   if( cr1.pos.getRangeTo(o.pos) <2 ) {
				       cr1.memory.my_target = null;
				   }
			       }
			       return ret;
			   } );
    },

    crstr_do_harv : function(cr) {
	return str_do_smth(cr,
			   function( cr1, rm1 ) { 
			       if(cr1.memory.tgt) {
				   var target = null;
				   target = Game.getObjectById(cr1.memory.tgt);
				   if(!target)
				       console.log('target not found');
				   return target;
			       }
			       return null;
			   },
			   function( cr1, o ) {
				   cr1.transferEnergy(o);
			   }
			   
			   // function( cr1, rm1 ) { return null; },
			   // function( cr1, o ) { return; }
			  );
    },

    crstr_do_harvest : function(cr) {
	return str_do_smth(cr, 
			   function( cr1, rm1 ) { 
			       var targets = rm1.find(FIND_MY_SPAWNS, {				       
				       filter: function(o) { return o.energy < o.energyCapacity; } } );

			       if(targets.length)
				   return targets[0];

			       var target = cr1.pos.findClosestByRange(FIND_MY_STRUCTURES, {
				       filter: function(o) { 
					   return (o.structureType == STRUCTURE_EXTENSION) && o.energy < o.energyCapacity; } } );

			       if(target)
				   return target;
			       
			       return null
			   },
			   function( cr1, o ) { return cr1.transferEnergy(o); } );
    }
};


var printObjectFnc = function(o) {
    var out = '';
    for (var p in o) {
	out += p + ': ' + o[p] + '\n';
    }
    console.log(out);
};

var str_do_smth = function( cr, where, what )
{
    var rm = cr.room;

    if(cr.memory.isMilitary) {
	cr.memory.step='working';
    }

    else if(cr.carry.energy == 0) {
	
	cr.memory.step='loading';
	
	if (cr.memory.my_target) {
	    cr.memory.my_target = null;
	}
	
	if(cr.carryCapacity>0 && cr.ticksToLive < 100)    {
	    cr.suicide();
	    return;
	}

	if( cr.memory.role == 'builder' || cr.memory.is_consumer ) {
	    if(rm.memory.buildersBallance < 0) {
		// console.log(cr.name + ' - waiting');
		rm.memory.buildersWaiting++;
		gotoWait(cr);
		return;
	    } else {
		// console.log(cr.name + ' - bal ' + rm.memory.buildersBallance);
		rm.memory.buildersBallance -= cr.carryCapacity;
	    }
	}
    }

    else if(cr.carry.energy >= cr.carryCapacity && cr.carryCapacity>0)
	cr.memory.step='working';

    if(cr.memory.step=='loading') {
	
	if (cr.memory.my_target) {
	    cr.memory.my_target = null;
	}

	var target = null;
	
	if(cr.carryCapacity>0 && cr.memory.role != 'harv' && !cr.memory.goHarvest) {


	    if( cr.memory.f_from && cr.memory.f_from == 'stay_put' ) {
		
		target = Game.getObjectById(cr.memory.tgt);
		
		if(!target) {
		    console.log( cr.name + ' - target not found');
		    return;
		}

		if (cr.pos.getRangeTo(target.pos) > 1) {
		    cr.moveTo(target);
		    return;
		}
		
		var target = cr.pos.findClosestByRange(FIND_DROPPED_ENERGY, { filter: function(o) { return cr.pos.getRangeTo(o.pos)<=2; } });
		if(target) {
		    cr.pickup(target);
		} else {
		    cr.memory.step = 'working';
		}
		return;
	    }

	    // may be go to flag
	    if(!cr.memory.flag) {
		var flg = null;
		
		if(!cr.memory.flag1) {
		    if( cr.memory.f_from ) {
			/*
			flg = cr.pos.findClosestByRange(FIND_FLAGS, { filter: function(o) { return o.name == cr.memory.f_from; } } );
			if(!flg)
			*/
			flg = Game.flags[cr.memory.f_from];
		    }
		    else {
			flg = cr.pos.findClosestByRange(FIND_FLAGS, { filter: function(o) { return o.name.substring(0,3) == 'res'; } } );
		    }
		    if(flg) {
			cr.memory.flag1 = flg.id;
		    }
		    
		} else {
		    flg = Game.getObjectById(cr.memory.flag1);
		    if(!flg)
			cr.memory.flag1 = null;
		}
		
		if(flg) {
		    if(flg.pos.roomName != cr.pos.roomName)		    
		    {
			var destRoomName = flg.pos.roomName;
			//			console.log('flag room - ' + destRoomName);
			var exitDir = cr.room.findExitTo(destRoomName);
			var exit = cr.pos.findClosest(exitDir);
			cr.moveTo(exit);
			return;
		    }
		    
		    if(cr.pos.getRangeTo(flg.pos.x,flg.pos.y) < 4) {
			//console.log('retarget');
			cr.memory.flag=1;
		    } else {
			var ret = cr.moveTo(flg.pos.x, flg.pos.y);
			// console.log('mt='+ret + ','+cr.memory.flag1.x);
		    }
		    return;
		} else {
		    console.log(cr.name + ' - flag not found');
		    return;
		}
	    }

	    target = cr.pos.findClosestByRange(FIND_DROPPED_ENERGY, 
					{ filter: function(o) { return o.energy>50 &&
								cr.pos.getRangeTo(o.pos)<10; } });

	    if(target) {
		cr.moveTo(target);
		cr.pickup(target);
	    } else if(cr.memory.role != 'carry' || cr.memory.is_consumer) {
		target = cr.pos.findClosestByRange(FIND_MY_STRUCTURES,
						   {filter: function(o) { return o.structureType==STRUCTURE_STORAGE } } );

		if(target) {
		    cr.moveTo(target);
		    target.transferEnergy(cr);
		} else {
		    console.log(cr.name + '-cannot find a storage');
		}
	    }

	}
	else {
	    if(cr.memory.src) {
		target = Game.getObjectById(cr.memory.src);

		if((!target || target.room != cr.room) && cr.memory.src == '55c34a6b5be41a0a6e80c19f') {
		    var exitDir = FIND_EXIT_BOTTOM; // cr.room.findExitTo(target.room);
		    var exit = cr.pos.findClosest(exitDir);
		    target = exit;
		}
		    
		// console.log('target - ' + target.energy );
		// printObjectFnc(target);
	    }
	    else
		target = cr.pos.findClosest(FIND_SOURCES);

	    if(!target)
		console.log('target not found ');
	    cr.moveTo(target);
	    cr.harvest(target);
	}
    }
    else {
	cr.memory.flag=0;
	cr.memory.flag1 = null;
	
	var target = where(cr, rm);
	if(target) {
	    cr.memory.my_target = target.id;
	    // cr.moveTo(target);
	    myCreepMoveTo(cr, target);
	    
	    what(cr, target);
	}
	else {
	    // console.log( cr.name + ':'+cr.memory.role + ' - have nothing to do' );
	    if (cr.memory.my_target) {
		cr.memory.my_target = null;
	    }

	    gotoWait(cr);
	}
    }
};

function gotoWait(cr) {

    var flag = cr.pos.findClosestByRange(FIND_FLAGS, { filter: function(o) { return o.name.substring(0,4) == 'wait'; } } );

    if(flag)
	cr.moveTo(flag.pos);
}

function myCreepMoveTo(cr, tgt) {
    var pos = tgt.pos ? tgt.pos :  tgt;

    if(cr.pos.isEqualTo(pos)){
	delete cr.memory.path;
	return;
    }
    
    var sl = cr.pos.lookFor('structure');
    var bOnRoad = false;
    for(var si in sl) {
	if (sl[si].structureType == STRUCTURE_ROAD ) {
	    bOnRoad = true;
	    break;
	}
    }

    if(!bOnRoad) {
	cr.moveTo(tgt);
	return;
    }

    if(cr.memory.path) {
	if(cr.memory.path.pos.isEqualTo(pos)) {
	    if( !cr.pos.isEqualTo(cr.memory.path.lastPos) ) {
		cr.memory.path.lastPos = cr.pos;
		cr.memory.path.idx += 1;
	    }
	    cr.move( cr.memory.path.path[cr.memory.path.idx] );
	    return;
	}
    }

    cr.memory.path = {pos: pos, idx: 0, lastPos: cr.pos};
    cr.memory.path.path = cr.room.findPath( cr.pos, pos, {ignoreCreeps: true} );
    cr.move( cr.memory.path.path[0] );
}

function myIsArray(o) {
    if( Object.prototype.toString.call( o ) === '[object Array]' )
	return true;
    return false;
}

function print_r(printthis, returnoutput) {
    var output = '';
    var comma = 0;
    if(myIsArray(printthis)) {
	output += '[ ';
        for(var i in printthis) {
	    if(comma) output += '\n, ';
            output += print_r(printthis[i], true);
	    ++comma;
        }
	output += ']';
    } else if(myIsArray(printthis) || typeof(printthis) == 'object') {
	output += '{ ';
        for(var i in printthis) {
	    if(comma) output += '\n, ';
	    ++comma;
            output += i + ' : ' + print_r(printthis[i], true);
        }
	output += '}';
    }else if(typeof(printthis) == 'string'){
        output += "'" + printthis + "'";
    } else {
        output += printthis;
    }
    if(returnoutput && returnoutput == true) {
        return output;
    }else {
        console.log(output);
    }
}


var genNamePrefix = function (creep, id) {
    var newName = creep.role + (creep.role_id ? ('_' + creep.role_id) : '');
    if(id)
	newName += '_' + id;

    return newName;
};

var vTable = module.exports.vTable;

// CPriorityQ
var CPriorityQ = function( ) {
};

vTable['CPriorityQ'] = new CPriorityQ();

CPriorityQ.prototype.cons = function(this_, store, class_) {
    console.log('CPriorityQ.prototype.cons( ' + class_ + ')');
    // var this_ = {};
    if(class_)
	this_.class_ = class_;
    else
	this_.class_ = 'CPriorityQ';
    this_.q = [];
    for(var i =0; i<100; ++i)
	this_.q[i] = [];
    this_.store = store;
    return this;
}

function getPriority(this_, o) { return vTable[this_.class_].getPriority(this_, o); }
CPriorityQ.prototype.getPriority = function(this_, o) {
    return o.p.priority;
};

function setPriority(this_, o, priority) { return vTable[this_.class_].setPriority(this_, o, priority); }
CPriorityQ.prototype.setPriority = function(this_, o, priority) {
    o.p.priority = priority;
};

function printQ(this_) { return vTable[this_.class_].printQ(this_); }
CPriorityQ.prototype.printQ = function(this_) {
    console.log('printQ: ' + this_.q.length);
    for(var qi in this_.q ){
	var qq = this_.q[qi];
	if(qq.length)
	    console.log('pri: ' + qi);
	if(qq) {
	    for(var qqi in qq) {
		console.log('    ' + qq[qqi]);
	    }
	}
    }
}

function getId(this_, o) { return vTable[this_.class_].getId(this_, o); }
CPriorityQ.prototype.getId = function(this_, o) {
    return o.id;
};

function getById(this_, id) { return vTable[this_.class_].getById(this_, id); }
CPriorityQ.prototype.getById = function(this_, id) {
    return Memory[this_.store][id];
};

function put(this_, o) { return vTable[this_.class_].put(this_, o); }
CPriorityQ.prototype.put = function(this_, o) {
    // console.log('CPriorityQ.prototype.put');
    var pri = getPriority(this_, o);
    var id = getId(this_, o);
    if(!pri) {
	console.log('invalid pri - ' + pri + ' for ' + o.p.priority);
    }
    var qq = this_.q[pri];
    if(!qq)
	this_.q[pri] = [id];
    else
	qq.push(id);
};

function remove(this_, o) { return vTable[this_.class_].remove(this_, o); }
CPriorityQ.prototype.remove = function(this_, o) {
    var id = getId(this_, o);
    var qq = this_.q[getPriority(this_, o)];
    
    if(qq) {
	for(var qqi in qq) {
	    if(qq[qqi] == id) {
		//console.log('1. splice ' + qq.length);
		// printObjectFnc(qq);
		qq.splice(qqi, 1);
		//console.log('2. splice ' + qq.length);
		// printObjectFnc(qq);
		break;
	    }
	}
    }
};

function changePriority(this_, o, pri) { return vTable[this_.class_].changePriority(this_, o, pri); }
CPriorityQ.prototype.changePriority = function(this_, o, pri) {

//    console.log('CPriorityQ.prototype.changePriority 1');
    if(getPriority(this_, o) == pri)
	return;

    var id = getId(this_, o);
    var qq = this_.q[getPriority(this_, o)];

//    console.log('CPriorityQ.prototype.changePriority ' + id);
    
    if(qq) {
	for(var qqi in qq) {
	    if(qq[qqi] == id) {
		// console.log('1. splice ' + qq.length);
		// printObjectFnc(qq);
		qq.splice(qqi, 1);
		// console.log('2. splice ' + qq.length);
		// printObjectFnc(qq);
		break;
	    }
	}
    }

    setPriority(this_, o, pri);
    put(this_, o);
};

function iterByPriority(this_, f) { return vTable[this_.class_].iterByPriority(this_, f); }
CPriorityQ.prototype.iterByPriority = function(this_, f) {
    for(var qi in this_.q) {
	var qq = this_.q[qi];
	for(var qqi in qq) {
	    var ret = f( getById(this_, qq[qqi]) );
	    if(ret)
		return ret;
	}
    }
    return null;
};

// return [object]
function findByPriority(this_, pri) { return vTable[this_.class_].findByPriority(this_, pri); }
CPriorityQ.prototype.findByPriority = function(this_, pri) {
    var qq = this_.q[pri];
    var ret = [];
    
    if(!qq)
	return ret;

    for(var qqi in qq) {
	ret.push( getById(this_, qq[qqi]) );
    }    
    return ret;
};


// CTargetQ
function CTargetQ() {
    CPriorityQ.call(this);
};

CTargetQ.prototype = Object.create(CPriorityQ.prototype);
CTargetQ.prototype.constructor = CTargetQ;

CTargetQ.prototype.getPriority = function(this_, o) {
    return o.p.target_id;
};

vTable['CTargetQ'] = new CTargetQ();

// CRoleQ
function CRoleQ() {
    CPriorityQ.call(this);
};
vTable['CRoleQ'] = new CRoleQ();
CRoleQ.prototype = Object.create(CPriorityQ.prototype);
CRoleQ.prototype.constructor = CRoleQ;

CRoleQ.prototype.getPriority = function(this_, o) {
    return o.p.role;
};

// CCreepIdQ
function CCreepIdQ() {
    CPriorityQ.call(this);
};
vTable['CCreepIdQ'] = new CCreepIdQ();

CCreepIdQ.prototype = Object.create(CPriorityQ.prototype);
CCreepIdQ.prototype.constructor = CCreepIdQ;

CCreepIdQ.prototype.getPriority = function(this_, o) {
    return o.p.id;
};


///

// id, target_id, priority, count, taken_by, cost{e}, role
var CJob = function(prop) {
    
    this.id = prop.id; //'job_' + Memory.next_id++;
    this.p = prop;
    if(!this.p.taken_by)
	this.p.taken_by = [];
    if(!this.p.cost)
	this.p.cost = {e:0};
};

var registerJob = function(this_) {
    console.log('Adding new job - ' + this_.id);

    if(Memory.job_by_id[this_.id])
	removeJob(this_);
    
    // console.log('CJob.prototype.register');
    
    // Memory.job_by_pri.__proto__ = CPriorityQ.prototype;
    // Memory.job_by_tgt.__proto__ = CTargetQ.prototype;
    
    Memory.job_by_id[this_.id] = this_;
    put(Memory.job_by_pri, this_);
    put(Memory.job_by_tgt, this_);
};

var removeJob = function(this_) {
    console.log('Remove job - ' + this_.id);
    
    remove(Memory.job_by_tgt, this_);
    remove(Memory.job_by_pri, this_);
    delete Memory.job_by_id[this_.id];
};

function addJobNewCreep( rm, it, repl ) {
    
    var props = it.props ? it.props : { };
    props.role = it.role;
    if(it.role_id)
	props.role_id = it.role_id;
    
    var jobId = 'newCreep_' + rm + '_' + genNamePrefix(props);
    if(repl)
	jobId += '_' + repl.id;

    var job = Memory.job_by_id[jobId];
    if(!job) {
	var expTime = repl ? (Game.time + repl.ticksToLive) : Game.time;
	var priority = expTime - Game.time;
	if(priority <= 0)
	    priority = 1;
	
	job = new CJob({id: jobId, expTime : expTime, 'it': it, priority: priority, role: 'spawn', rm: rm, repl: repl.id });
	registerJob(job);
    } else {
	var priority = job.p.expTime - Game.time;
	if(priority <= 1) {
	    removeJob( job );
	}
	else {
	    // Memory.job_by_pri.changePriority(priority);
	    changePriority( Memory.job_by_pri, job, priority );
	}
    }

}

function getNextJobForSpawn(sp) {
//    console.log('getNextJobForSpawn');

    var jobs_del=[];
    var ret_job = iterByPriority(Memory.job_by_pri, function(job) {
	if(job.p.role == 'spawn' && job.p.taken_by.length == 0) {
//	    console.log(job.id);

	    if(!job.p.repl || job.p.repl && !Game.getObjectById(job.p.repl))
		jobs_del.push(job.id); // expired job
	    else /*if(job.rm == sp.room.id)*/ {
		job.p.taken_by.push(sp.id);
		return job;
	    }
	}
    } );

    for(var di in jobs_del) {
//	console.log('deleting job - ' + Memory.job_by_id[jobs_del[di]].id);
	removeJob( Memory.job_by_id[jobs_del[di]] );
    }

    return ret_job;
}


// id, role, 
var CWorker = function(prop) {
    this.id = 'wrk_' + Memory.next_id++;
    this.p = prop;
};

CWorker.prototype.register = function() {
    Memory.wrk_by_id[this.id] = this;
    Memory.wrk_by_role.put(this)
    Memory.wrk_by_creep_id.put(this)
};

/*
function updateWorkers(rm) {
    var creeps = rm.find(FIND_MY_CREEPS);
    
    for(var ic in  creeps)
    {
	var c = creeps[ic];
	
    }    
}

*/

/*
var CCreep = function (creep) {
    this.id = creep.id;
    this.role = creep.memory.role;
};

CCreep.prototype.isConsumer() {
    return false;
}

*/

