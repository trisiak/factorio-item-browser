import { observer } from "mobx-react-lite";
import React, { FC } from "react";
import { Trans } from "react-i18next";
import ExternalLink from "../link/ExternalLink";
import ExternalLinkIcons from "./footer/ExternalLinkIcons";

import "./Footer.scss";

const year = new Date().getFullYear();

/**
 * The component representing the footer of the page.
 */
const Footer: FC = () => {
    return (
        <footer>
            <div className="copyright">
                © {year} Factorio Item Browser
                <br />
                <Trans i18nKey="footer.fork-disclaimer">
                    An independent fork of the original
                    <ExternalLink url="https://github.com/factorio-item-browser/portal-frontend">
                        Factorio Item Browser
                    </ExternalLink>
                    .
                </Trans>
                <br />
                <Trans i18nKey="footer.copyright-disclaimer">
                    All content and images are owned by
                    <ExternalLink url="https://www.factorio.com/">Wube Software</ExternalLink>
                    and the
                    <ExternalLink url="https://mods.factorio.com/">mod authors</ExternalLink>
                    respectively.
                </Trans>
                <br />
                <Trans i18nKey="footer.data-disclaimer">
                    Item and recipe data currently provided by
                    <ExternalLink url="https://factoriolab.github.io/">FactorioLab</ExternalLink>.
                </Trans>
            </div>

            <ExternalLinkIcons />
        </footer>
    );
};

export default observer(Footer);
