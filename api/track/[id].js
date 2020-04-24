const got = require('got');
const xml = require('fast-xml-parser');

const ERRORS = {
  100: 'Missing token.',
  101: 'Missing client ID.',
  102: 'Missing tracking ID.',
  103: 'Invalid tracking ID.',
  104: 'Strange tracking ID.',
  105: 'Unknown tracking ID.',
};

const j2x = new xml.j2xParser({
  ignoreAttributes: false,
  attributeNamePrefix: '$',
});

const {
  URL = 'http://webservice.serpost.com.pe/ws_appmovil/ServiceAppMovil.svc',
  ACTION = 'WebService.net/IServiceAppMovil/WS_ConsultarTracking',
  TOKEN = '',
  CLIENT = '',
} = process.env;

/**
 * @param {number} code
 * @throws {Error}
 */
function fail(code) {
  if (!code) return;
  const err = new Error(ERRORS[code]);
  err.code = code;
  throw err;
}

/**
 * @param {string} s
 * @returns {number}
 */
function timestamp(s) {
  if (!(s = s.trim())) return 0;
  return Date.parse(
    s.replace(
      /^(\d\d)\/(\d\d)\/(\d{4})\s?-\s?(\d\d):(\d\d)$/,
      '$3-$2-$1T$4:$5:00-05:00'
    )
  );
}

/**
 * @param {?string} id
 * @returns {number}
 */
function validate(id) {
  if (!id || !(id = id.trim().toUpperCase())) return 102;

  const match = id.match(/^[A-Z]{2}(\d{8})(\d)[A-Z]{2}$/);
  if (!match) return 103;

  // Taken from:
  // https://en.wikipedia.org/wiki/S10_(UPU_standard)#Check-digit_calculation
  const weight = [8, 6, 4, 2, 3, 5, 9, 7];
  let check = match[1]
    .split('')
    .map((d, i) => d * weight[i])
    .reduce((p, c) => p + c);
  check = 11 - (check % 11);
  if (check == 10) check = 0;
  if (check == 11) check = 5;
  if (check != match[2]) return 103;

  // The only supported by Serpost
  // TODO: Test real tracking support
  return /^[ACELRV]/.test(id) ? 0 : 104;
}

/**
 * @param {Object} req
 * @param {Object} req.query
 * @param {?string} req.query.id
 * @param {Object} res
 * @see {@link ${URL}?singleWsdl}
 */
async function handler({ query: { id } }, res) {
  const ret = {};

  try {
    // Should never reach
    if (!TOKEN) fail(100);
    if (!CLIENT) fail(101);

    fail(validate(id));
    id = id.trim().toUpperCase();

    const req = await got.post(URL, {
      throwHttpErrors: false,
      headers: {
        'Content-Type': 'text/xml; charset=utf-8',
        SOAPAction: ACTION,
      },
      body: j2x.parse({
        's:Envelope': {
          '$xmlns:s': 'http://schemas.xmlsoap.org/soap/envelope/',
          's:Body': {
            WS_ConsultarTracking: {
              $xmlns: 'WebService.net',
              TOKEN,
              CODCLIENTE: CLIENT,
              NUMORIGEN: id,
            },
          },
        },
      }),
    });
    // TODO: Make typedefs to avoid unexpected typos
    let data = xml.parse(req.body, { ignoreNameSpace: true }).Envelope.Body;

    if (data.Fault) fail(+data.Fault.faultcode.substr(2));
    data = data.WS_ConsultarTrackingResponse.WS_ConsultarTrackingResult;
    if (typeof data.ITEMS == 'string') fail(105);

    ret.data = {
      id,
      document: data.DOCUMENTO,
      recipient: data.DESTINATARIO,
      delivered: timestamp(data.FECHAENTREGA),
      origin: data.OFICINAORIGEN,
      destination: data.OFICINADESTINO,
      history: data.ITEMS.ItemDetalle.map((detail) => ({
        date: timestamp(detail.FECHAHORA),
        description: detail.DESCRIPCION,
      })).reverse(),
    };
  } catch (err) {
    ret.error = {
      code: err.code || 500,
      message: err.message,
    };
  }

  res.status(200).json(ret);
}

module.exports = handler;
