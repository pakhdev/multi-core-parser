import * as he from 'he';

import { CompanyInfo } from '../interfaces/company-info.interface';

export class CompanyPage {

    static parseTableLines(html: string): CompanyInfo | null {
        if (!html) return null;
        const sucursales_links = this.parseSucursales(html);
        let companyInfo: CompanyInfo = {};
        if (sucursales_links) companyInfo.sucursales_links = sucursales_links;

        const regexTable = /<table[^>]*?id="tablaInformesSuperetiqueta"[^>]*>([\s\S]*?)<\/table>/gi;
        const matchesTable = html.matchAll(regexTable);
        if (!matchesTable) return null;

        for (const matchTable of matchesTable) {
            const regexTrs = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
            const trs = matchTable[1].matchAll(regexTrs);
            for (const tr of trs) {
                const thRegex = /<th[^>]*[^>]*>([\s\S]*?)<\/th>/i;
                const tdRegex = /<td[^>]*>([\s\S]*?)<\/td>/i;

                const thMatch = tr[1].match(thRegex);
                const tdMatch = tr[1].match(tdRegex);

                if (thMatch && tdMatch) {
                    const type = thMatch[1].trim();
                    const content = tdMatch[1].trim();
                    companyInfo = CompanyPage.processProperty({ type, content }, companyInfo);
                }
            }
        }

        return Object.keys(companyInfo).length > 0 ? companyInfo : null;
    }

    static parseSucursales(html: string): string[] | null {
        if (!html) return null;
        const regexContainer = /<div[^>]*?id="modulo-ayudas-cnae"[^>]*>([\s\S]*?)<\/div>/gi;
        const matchesContainer = html.matchAll(regexContainer);
        const sucursalesArray: string[] = [];

        for (const container of matchesContainer) {
            if (container[1].includes('<h3 class="title03A pt0">Sucursales de')) {
                const regexLinks = /<a\s+(?:[^>]*?\s+)?href="https:\/\/www.einforma.com\/sucursales\/([^"]*)\/"/gi;
                let match;
                while ((match = regexLinks.exec(html)) !== null) {
                    sucursalesArray.push(match[1]);
                }
            }

        }

        return sucursalesArray.length > 0 ? sucursalesArray : null;
    }

    static processProperty(property: { type: string, content: string }, companyInfo: CompanyInfo): CompanyInfo {
        let propertyName = '';
        switch (property.type) {
            case 'Nombre Comercial':
                propertyName = 'nombre_comercial';
                console.log(property.content);
                if (property.content.includes('<ul class=')) {
                    property.content = CompanyPage.extractNames(property.content);
                }
                break;
            case 'Denominaci&oacute;n':
                propertyName = 'denominacion';
                break;
            case 'CIF/NIF':
                propertyName = 'cif_nif';
                break;
            case 'C&oacute;digo Postal':
                propertyName = 'zip_code';
                break;
            case 'Provincia':
                propertyName = 'provincia';
                break;
            case 'Municipio':
                propertyName = 'localidad';
                break;
            case 'Domicilio social actual':
                propertyName = 'domicilio';
                if (property.content.includes('Ver Mapa')) {
                    companyInfo = CompanyPage.processProperty({
                        type: 'Coordenadas',
                        content: property.content,
                    }, companyInfo);
                    property.content = this.matchRegexp(property.content, /^(.*?)(?=<span)/s, 1);
                }
                break;
            case 'CNAE':
                propertyName = 'cnae';
                companyInfo = CompanyPage.processProperty({
                    type: 'CNAE desc',
                    content: property.content,
                }, companyInfo);
                property.content = this.matchRegexp(property.content, /^\d+/, 0);
                break;
            case 'CNAE 2009':
                propertyName = 'cnae';
                companyInfo = CompanyPage.processProperty({
                    type: 'CNAE desc',
                    content: property.content,
                }, companyInfo);
                property.content = this.matchRegexp(property.content, /^\d+/, 0);
                break;
            case 'CNAE desc':
                propertyName = 'cnae_desc';
                property.content = property.content.replace(/^\d+\s*-\s*/, '');
                break;
            case 'SIC':
                propertyName = 'sic';
                companyInfo = CompanyPage.processProperty({ type: 'SIC desc', content: property.content }, companyInfo);
                property.content = this.matchRegexp(property.content, /^\d+/, 0);
                break;
            case 'SIC desc':
                propertyName = 'sic_desc';
                property.content = property.content.replace(/^\d+\s*-\s*/, '');
                break;
            case 'Forma Jur&iacute;dica':
                propertyName = 'forma_juridica';
                break;
            case 'Tel&eacute;fono':
                propertyName = 'tlf_principal';
                property.content = this.matchRegexp(property.content, /\b\d{9}\b/, 0);
                break;
            case 'Otros tel&eacute;fonos':
                propertyName = 'tlf_otros';
                property.content = CompanyPage.parsePhoneNumbers(property.content);
                break;
            case 'Web':
                propertyName = 'web';
                property.content = property.content.replace(/<\/?[^>]+(>|$)/g, '');
                break;
            case 'Capital Social':
                propertyName = 'capital_social';
                break;
            case 'Tama&ntilde;o por Ventas':
                propertyName = 'ventas_tamano';
                break;
            case 'N&uacute;mero de Empleados':
                propertyName = 'empleados_num';
                break;
            case 'Actividades Internacionales':
                propertyName = 'act_internacionales';
                break;
            case 'Fax':
                propertyName = 'fax';
                break;
            case 'Coordenadas':
                const coordinatesRegex = /latitud="(.*?)" longitud="(.*?)"/i;
                const coordinatesMatch = property.content.match(coordinatesRegex);
                if (coordinatesMatch) {
                    property.content = `${ coordinatesMatch[1] }|${ coordinatesMatch[2] }`;
                }
                propertyName = 'coordenadas';
                break;
            case 'Fecha Constituci&oacute;n':
                propertyName = 'constitucion_fecha';
                break;
            case 'Actualizaci&oacute;n Ficha Empresa':
                propertyName = 'ultima_actualizacion';
                break;
        }
        if (propertyName && property.content)
            companyInfo[propertyName] = he.decode(property.content.trim());
        return companyInfo;
    }

    static matchRegexp(html: string, regexp: RegExp, index: number): string | null {
        const match = html.match(regexp);
        return match ? match[index] : null;
    }

    static parsePhoneNumbers(html: string): string | null {
        const regex = /<div class="mb5">(\d+)<\/div>/g;
        const matches = [];
        let match;
        while ((match = regex.exec(html)) !== null) {
            matches.push(match[1]);
        }
        return matches.length > 0 ? matches.join('|') : null;
    }

    static extractNames(html: string): string {
        return html.replace('<ul class="ulclear">', '').replace('</ul>', '').split('<li>').filter(name => name !== '').join('|');
    }

}