module.exports = {

    // init : function() {
    // 	crstr[
    // },

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

    str_maintian_creeps : function(lst, rm)
    {
	var creeps = rm.find(FIND_MY_CREEPS);
	var roles = [];
	var created = 0;
	var spawning = 0;

	Memory.rooms['E9S8'].spawning=0;

	for(var ic in  creeps)
	{
	    var c = creeps[ic];
	    var cr = c.memory.role + (c.memory.role_id ? c.memory.role_id : '');
	    // console.log( 'found ' + c.name + ' : ' + cr );
	    if(!roles[cr])
		roles[cr] = [c];
	    else
		roles[cr].push(c);
	}

	for(var i in lst)
	{
	    var it = lst[i];
	    //	    printObjectFnc(lst[it]);
	    //	    console.log('role: ' + it['role']);

	    var it_name = it.role + (it.role_id ? it.role_id : '');

	    var curCount = 0;
	    if(roles[it_name] && roles[it_name] == 'del') {
		console.log('duplicate ' + it_name);
		continue;
	    }

	    curCount = roles[it_name] ? roles[it_name].length : 0;

	    // console.log(it.role + ', ' + it.count + ', ' + curCount);
	    
	    if( it.count > curCount )
		{
		    roles[it_name] = 'del';
		    Memory.rooms['E9S8'].spawning=1;

		    if(rm.find(FIND_MY_SPAWNS)[0].spawning || created)
		    	continue;

		    var props = it.props ? it.props : { };
		    props.role = it.role;
		    if(it.role_id)
			props.role_id = it.role_id;

		    var newName = rm.find(FIND_MY_SPAWNS)[0].createCreep( it.body, undefined, props );
		    if(newName != -6)
			console.log('spawning ' + props.role + ' - ' + newName);
		    
		    
		    created = 1;
		    //break;
		}
	    else if( it.count < curCount )
		{
		    console.log('killing ' + it.role);
		    roles[it_name][0].suicide();
		}
	    roles[it_name] = 'del';

	}

	for(var j in roles) {
	    var jit = roles[j];

	    if(jit && jit == 'del') {
		continue;
	    }
	    if(jit) {
		console.log('killing ' + it.role);
		jit[0].suicide();
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
		c = 2;

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
				   console.log('target not found');
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
			       return null;
			   },
			   function( cr1, o ) { 
			       var dist = cr1.memory.pos_to.d ? cr1.memory.pos_to.d : 0;
			       if(cr1.pos.getRangeTo(o.x,o.y) <= dist)
				   cr1.dropEnergy();
			   } );
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
			   function( cr1, rm1 ) { return null; },
			   function( cr1, o ) { return; } );
    },

    crstr_do_harvest : function(cr) {
	return str_do_smth(cr, 
			   function( cr1, rm1 ) { 
			       var targets = rm1.find(FIND_MY_SPAWNS, {				       
				       filter: function(o) { return o.energy < o.energyCapacity; } } );

			       if(targets.length)
				   return targets[0];

			       var targets = rm1.find(FIND_MY_STRUCTURES, {
				       filter: function(o) { 
					   return (o.structureType == STRUCTURE_EXTENSION) && o.energy < o.energyCapacity; } } );

			       if(targets.length)
				   return targets[0];
			       
			       return null
			   },
			   function( cr1, o ) { return cr1.transferEnergy(o); } );
    }
}

printObjectFnc = function(o) {
    var out = '';
    for (var p in o) {
	out += p + ': ' + o[p] + '\n';
    }
    console.log(out);
};

str_do_smth = function( cr, where, what )
{
    var rm = cr.room;
    
    if(cr.carry.energy == 0) {
	
	cr.memory.step='loading';
	
	if (cr.memory.my_target) {
	    cr.memory.my_target = null;
	}
	
	if(cr.carryCapacity>0 && cr.ticksToLive < 100)    {
	    cr.suicide();
	    return;
	}

	if( cr.memory.role == 'builder' ) {
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

    if(cr.carry.energy >= cr.carryCapacity && cr.carryCapacity>0)
	cr.memory.step='working';

    if(cr.memory.step=='loading') {
	
	if (cr.memory.my_target) {
	    cr.memory.my_target = null;
	}

	var target = null;
	
	if(cr.carryCapacity>0) {


	    if( cr.memory.f_from && cr.memory.f_from == 'stay_put' ) {

		target = Game.getObjectById(cr.memory.tgt);
		
		if(!target) {
		    console.log( cr.name + ' - target not found');
		    return;
		}

		if (cr.pos.getRangeTo(target.pos) > 0) {
		    cr.moveTo(target);
		    return;
		}
		
		var target = cr.pos.findClosestByRange(FIND_DROPPED_ENERGY, { filter: function(o) { return cr.pos.getRangeTo(o.pos)<=1; } });
		if(target) {
		    cr.pickup(target);
		} else {
		    cr.memory.step = 'working';
		}
	    }

	    // may be go to flag
	    if(!cr.memory.flag) {
		if(!cr.memory.flag1) {
		    if( cr.memory.f_from )
			cr.memory.flag1 = cr.pos.findClosestByRange(FIND_FLAGS, { filter: function(o) { return o.name == cr.memory.f_from; } } ).pos;
		    else
			cr.memory.flag1 = cr.pos.findClosestByRange(FIND_FLAGS, { filter: function(o) { return o.name.substring(0,3) == 'res'; } } ).pos;
		}


		if(cr.pos.getRangeTo(cr.memory.flag1.x,cr.memory.flag1.y) < 4) {
		    //console.log('retarget');
		    cr.memory.flag=1;
		} else {
		    var ret = cr.moveTo(cr.memory.flag1.x, cr.memory.flag1.y);
		    // console.log('mt='+ret + ','+cr.memory.flag1.x);
		}
		return;
	    }

	    target = cr.pos.findClosest(FIND_DROPPED_ENERGY, 
					{ filter: function(o) { return o.energy>50 &&
								cr.pos.getRangeTo(o.pos)<10; } });

	    if(target) {
		cr.moveTo(target);
		cr.pickup(target);
	    }
	}
	else {
	    if(cr.memory.src) {
		target = Game.getObjectById(cr.memory.src);
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
	    cr.moveTo(target);
	    
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
