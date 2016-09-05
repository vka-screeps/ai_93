var u = require('utils');
var _ = require('lodash');


// class TaskClaim extends Task {
//     constructor(d, parent) {
// 	super(d, parent);
//     }
    
//     static cname() { return 'TaskClaim'; }

//     updateJobs(rm) {
// 	// u.log( "updateJobs is not implemented", u.LOG_WARN);
//     }
// }


module.exports = function (memobj) {
    var f = memobj.f;
    var CMemObj = memobj.CMemObj;

    class Task extends CMemObj {
	constructor(d, parent) {
	    super(d, parent);
	}
	
	static cname() { return 'Task'; }


	// {
	// 	job_type: 'JobCarrier',
	// 	job_id: 'carry_123',
	// }
	
	get_cur_jobs(rm) { return []; }
	free_resources(rm) { }

	maybeCreateJob(rm) {};
	maybeCompleteJob(rm) {};
	
	updateJobs(rm) {
	    let d = this.d;
	    if(d.postDelete) {
		let job_lst = this.get_cur_jobs(rm);

		let exists = false;
		job_lst.forEach( (j)=> {
		    let job = rm.memory.jobs[j.job_type][j.job_id];
		    if(job) {
			rm.memory.jobs[j.job_type][j.job_id].done = true;
			exists = true;
		    }
		} );

		if(!exists) {
		    // remove the point
		    this.free_resources(rm);
		    delete rm.memory.tasks[d.id];
		    u.log( "Deleting object " + d.id, u.LOG_INFO );
		}
	    } else {
		// may be create some jobs

		if(get_cur_jobs(rm).length == 0) {
		    this.maybeCreateJob(rm);
		} else {
		    this.maybeCompleteJob(rm);
		}
	    }	
	}
    }

    memory.regClasses(['Task']);

    return {
	Task: Task
    };
}
