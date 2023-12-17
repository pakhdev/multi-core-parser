export class SearchPage {

    static getSearchResult(html: string | null, url: string): string | null {
        if (!html) return null;
        const regex = /<li[^>]*class="b_algo"[^>]*>([\s\S]*?)<\/li>/gi;
        const matches = html.matchAll(regex);
        for (const match of matches) {
            const htmlInsideResult = match[1].trim();
            const linkInsideResult = SearchPage.getResultLink(htmlInsideResult);
            if (linkInsideResult === url) return SearchPage.getResultCacheId(htmlInsideResult);
        }
        return null;
    }

    static getResultLink(html: string): string | null {
        const match = html.match(/<a[^>]*?href=["']([^"']*)["'][^>]*>/i);
        return match ? match[1] : null;
    }

    static getResultCacheId(html: string): string {
        const match = html.match(/<div[^>]*?class="b_attribution"[^>]*\su=["']([^"']*)["'][^>]*>/i);
        if (match) {
            const attributions = match[1].split('|');
            return attributions[attributions.length - 1];
        }
        return null;
    }
}