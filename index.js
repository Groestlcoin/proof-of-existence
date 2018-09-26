const bitcoin = require("bitcoinjs-lib");
const axios = require("axios");
const moment = require("moment");

const checkOrAddFileFromDataUri = async (dataUri = "") => {
	try {
		if (!_isDataUri(dataUri)) return { error: true, data: "Invalid Data URI." };
		let exists = false;
		let dateCreated = null;

		//Setup Bitcoin Address
		const { privateKey, p2shAddress, bech32Address } = generateAddressesFromDataUri(dataUri);

		//Fetch Address Info To Determine If The File Already Exists (If (first_seen_receiving !== null) The File Exists)
		const { balance: p2shBalance, first_seen_receiving: p2shFirstSeenReceiving } = await _getAddressInfo(p2shAddress);
		const { balance: bech32Balance, first_seen_receiving: bech32FirstSeenReceiving } = await _getAddressInfo(bech32Address);

		if (p2shFirstSeenReceiving !== null || bech32FirstSeenReceiving !== null) {
			exists = true;

			if (p2shFirstSeenReceiving !== null && bech32FirstSeenReceiving !== null) {
				const p2shDate = new moment(p2shFirstSeenReceiving);
				const bech32Date = new moment(bech32FirstSeenReceiving);
				dateCreated = p2shDate < bech32Date ? p2shFirstSeenReceiving : bech32FirstSeenReceiving;
			} else {
				dateCreated = p2shFirstSeenReceiving !== null ? p2shFirstSeenReceiving : bech32FirstSeenReceiving;
			}
		}

		return { error: false, exists, privateKey, p2shAddress, bech32Address, dateCreated  }

	} catch (e) {
		console.log(e);
		return { error: true, data: e }
	}
};

const generateAddressesFromDataUri = (dataUri = "") => {
	try {
		if (!_isDataUri(dataUri)) return { error: true, data: "Invalid Data URI." };

		const hash = bitcoin.crypto.sha256(dataUri);
		//Create Private Key & Address From Hash
		const keyPair = bitcoin.ECPair.fromPrivateKey(hash);
		const privateKey = keyPair.toWIF();
		const p2sh = bitcoin.payments.p2sh({
			redeem: bitcoin.payments.p2wpkh({ pubkey: keyPair.publicKey })
		});
		const p2shAddress = p2sh.address;
		const bech32 = bitcoin.payments.p2wpkh({ pubkey: keyPair.publicKey });
		const bech32Address = bech32.address;

		return { privateKey, p2shAddress, bech32Address };
	} catch (e) {
		console.log(e);
		return { error: true, data: e }
	}
};

const _isDataUri = (dataUri) => {
	const dataUriRegex = /^\s*data:([a-z]+\/[a-z]+(;[a-z\-]+\=[a-z\-]+)?)?(;base64)?,[a-z0-9\!\$\&\'\,\(\)\*\+\,\;\=\-\.\_\~\:\@\/\?\%\s]*\s*$/i;
	return !!dataUri.match(dataUriRegex);
};

const _getAddressInfo = async (address = "") => {
	try {
		const result = await axios({
			method: "GET",
			url: `https://api.blockchair.com/bitcoin/dashboards/address/${address}`
		});
		return { balance: result.data.data[address].address.balance, first_seen_receiving: result.data.data[address].address.first_seen_receiving}
	} catch (e) {
		console.log(e);
	}
};

module.exports = {
	checkOrAddFileFromDataUri,
	generateAddressesFromDataUri
};