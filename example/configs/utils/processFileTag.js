const crypto = require('crypto');
const _ = require('lodash');
const path = require('path');
const fs = require('fs-extra');

const decodeQueryParamsString = (queryParamsString) => {
  return _.chain(queryParamsString).replace('?', '').split('&').map(_.partial(_.split, _, '=', 2)).fromPairs().value();
};

const generateChecksum = (str, algorithm, encoding) => {
  return crypto
    .createHash(algorithm || 'sha1')
    .update(str, 'utf8')
    .digest(encoding || 'hex');
};

const objectToQueryString = (obj, keepEmpty = false) => {
  const results = [];
  _.forOwn(obj, (value, key) => {
    if (!keepEmpty && (value === null || value === undefined)) {
      return;
    }
    if (Array.isArray(value)) {
      _.forOwn(value, (iValue) => {
        results.push(`${key}[]=${encodeURIComponent(iValue)}`);
      });
    } else {
      results.push(`${key}=${encodeURIComponent(value)}`);
    }
  });
  return results.join('&');
};

const processFileTag = (content, { $, tagSelector, fileAttr, htmlFile, withIntegrity }) => {
  $(tagSelector).each(function () {
    const currentSrc = $(this).attr(fileAttr);
    if (currentSrc && !currentSrc.includes('://')) {
      // Parse a link to a file
      const currentSrcParts = currentSrc.split('?');
      const urlFile = currentSrcParts[0];
      const urlParams = currentSrcParts[1];
      let urlParamsObj = {};
      if (urlParams) {
        urlParamsObj = decodeQueryParamsString(urlParams);
      }

      // Get the checksum of the file
      const filePath = path.resolve(htmlFile, '..', urlFile);
      if (!fs.pathExistsSync(filePath)) {
        // If there is no such file, continue on
        if (isVerbose) {
          console.warn(`(!) File ${htmlFile} contains a non-existent link ${currentSrc}`);
        }
        return;
      }
      const fileContent = fs.readFileSync(filePath, 'utf8');
      const fileCheckSum = generateChecksum(fileContent).substring(0, 10);

      // Generation of integrity attributes (JS only)
      let integrityAttributesStr = '';
      if (withIntegrity && filePath.endsWith('.js')) {
        const sha384CheckSum = generateChecksum(fileContent, 'sha384', 'base64');
        integrityAttributesStr = ` integrity="sha384-${sha384CheckSum}" crossorigin="anonymous" onerror="alert('Violation of the integrity of the resource')"`;
      }

      // Generating a new link to the file
      urlParamsObj['v'] = fileCheckSum;
      const resultSrc = `${urlFile}?${objectToQueryString(urlParamsObj)}`;

      // Substitute this link
      content = content.replace(`"${currentSrc}"`, `"${resultSrc}"${integrityAttributesStr}`);
    }
  });

  return content;
};

module.exports = processFileTag;