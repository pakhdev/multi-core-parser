import axios from 'axios';
import * as fs from 'fs';

import { Task } from '../interfaces/task.interface';
import { SearchPage } from '../../parsers/classes/search-page.class';
import { BackendTask } from '../interfaces/backend-task.interface';
import { CompanyPage } from '../../parsers/classes/company-page.class';
import { CompanyInfo } from '../../parsers/interfaces/company-info.interface';

const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0' +
        ' Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
    'Accept-Encoding': 'gzip, deflate',
    'Accept-Language': 'es-ES,es;q=0.7,en-US;q=0.5,en;q=0.3',
};

class CoreWorker {

    constructor() {
        this.listenDirector();
    }

    private listenDirector(): void {
        process.on('message', (task: Task) => {
            switch (task.actionName) {
                case 'searchPage':
                    task.backendTask ? this.processSearchPage(task.backendTask, task.attempt) : this.processSearchPage();
                    break;
                case 'companyPage':
                    this.processCompanyPage(task);
                    break;
                default:
                    break;
            }
        });
    }

    private sendToDirector(task: Task): void {
        process.send(task);
    }

    private async processSearchPage(loadedBackendTask?: BackendTask, attempt = 0): Promise<void> {
        const backendTask = loadedBackendTask || await this.getTaskFromBackend();
        if (!backendTask) return;

        const einformaLink = 'https://www.einforma.com/informacion-empresa/' + encodeURIComponent(backendTask.einf_link.trim());
        const searchLink = `https://www.bing.com/search?q=url:${ einformaLink }`;
        const html = await this.downloadPage(searchLink);
        const cacheId = SearchPage.getSearchResult(html, einformaLink);
        if (!cacheId) {
            this.sendToDirector({
                actionName: 'searchPage',
                attempt: attempt + 1,
                backendTask,
            });
            return;
        }

        this.sendToDirector({
            id: backendTask.id,
            einf_link: backendTask.einf_link,
            actionName: 'companyPage',
            url: `https://cc.bingj.com/cache.aspx?q=a&d=1&w=${ cacheId }`,
            attempt: 0,
        });
    }

    private async processCompanyPage(task: Task): Promise<void> {
        const html = await this.downloadPage(task.url);
        const companyInfo = CompanyPage.parseTableLines(html);
        if (!companyInfo) {
            task.attempt++;
            this.sendToDirector(task);
            return;
        }

        companyInfo.id = task.id;
        this.sendToBackend(companyInfo);
        this.saveHtml(html, task.einf_link.trim());
    }

    private async getTaskFromBackend(): Promise<BackendTask | null> {
        return await axios.get<BackendTask>('http://localhost:3002/empresas').then(res => res.data);
    }

    private async sendToBackend(companyInfo: CompanyInfo): Promise<void> {
        await axios.post('http://localhost:3002/empresas', companyInfo);
    }

    private async downloadPage(url: string): Promise<string | null> {
        return axios.get(url, { headers }).then(response => {
            const bodyRegex = /<body[^>]*>([\s\S]*?)<\/body>/i;
            const bodyMatch = response.data.match(bodyRegex);
            return bodyMatch ? bodyMatch[1].replace(/\n/g, '') : null;
        });
    }

    private saveHtml(html: string, fileName: string): void {
        fs.writeFile(`../html_backup/${ fileName }.txt`, html, function (err) {
            if (err) return console.log(err);
        });
    }
}

new CoreWorker();