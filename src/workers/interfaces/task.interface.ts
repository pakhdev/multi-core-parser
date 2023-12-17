import { BackendTask } from './backend-task.interface';

export interface Task {
    id?: number;
    einf_link?: string;
    url?: string;
    actionName: 'searchPage' | 'companyPage';
    attempt: number;
    backendTask?: BackendTask;
}