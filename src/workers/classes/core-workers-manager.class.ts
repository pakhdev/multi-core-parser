import os from 'os';
import cp from 'child_process';

import { Task } from '../interfaces/task.interface';
import axios from 'axios';

export class CoreWorkersManager {

    private readonly maxQps: number = 8;
    private readonly maxAttempts: number = 3;
    private readonly tasks: Task[] = [];
    private readonly workers: cp.ChildProcess[] = [];
    private qps: number = 0;
    private lastWorker: number | null = null;

    constructor(maxCores?: number) {
        const cpuCount = os.cpus().length;
        const useCores = maxCores && maxCores > 0 && maxCores <= cpuCount ? maxCores : cpuCount;
        this.initWorkers(useCores);
    }

    private initWorkers(useCores: number): void {
        for (let i = 0; i < useCores; i++) {
            const coreWorker = cp.fork('./workers/classes/core-worker.class');
            coreWorker.on('message', (task: Task) => {
                if (task.attempt && task.attempt === this.maxAttempts) {
                    this.setError(task.backendTask.id);
                } else {
                    this.tasks.push(task);
                }
            });
            this.workers.push(coreWorker);
        }
        this.tasksSender();
    }

    private tasksSender(): void {
        setInterval(() => {
            if (this.qps < this.maxQps) {
                const task = this.getTask();
                if (task) {
                    this.distributeTask(task);
                    this.qps++;
                    setTimeout(() => this.qps--, 1000);
                }
            }
        }, 50);
    }

    private sendToWorker(worker: cp.ChildProcess, task: Task): void {
        worker.send(task);
    }

    private async setError(id: number) {
        await axios.post('http://localhost:3002/empresas', { id, isFailed: 1 });
    }

    private getTask(): Task {
        if (this.tasks.length) return this.tasks.pop();
        return { actionName: 'searchPage', attempt: 0 } as Task;
    }

    private distributeTask(task: Task): void {
        const nextWorker = this.lastWorker === this.workers.length - 1 ? 0 : this.lastWorker + 1;
        this.sendToWorker(this.workers[nextWorker], task);
    }

}