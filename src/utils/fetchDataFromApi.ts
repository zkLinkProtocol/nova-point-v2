const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export const fetchAPIData = async <T>(url: string): Promise<any> => {
    let data;
    let errors;
    let retry = true;
    let retryCount = 0;
    const maxRetries = 10;
    while (retry && retryCount < maxRetries) {
        try {
            const response = await fetch(url, {
                method: "GET",
                headers: { "Content-Type": "application/json" },
                signal: AbortSignal.timeout(10000)
            });
            ({ data, errors } = await response.json());

            if (!errors) {
                retry = false;
            }
        } catch (error) {
            retryCount++;
            console.error("Fetch error:", error);
        }

        if (errors) {
            console.error("Errors detected, retrying in 5 seconds...", errors);
            await delay(5000);
            retryCount++;
        }
    }

    if (retryCount >= maxRetries) {
        console.error("Maximum retry limit reached");
    }
    console.log(data)
    return [
        { address: '0x1234567890abcdef1234567890abcdef12345678', amount: 1 },
        { address: '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd', amount: 0.5 },
        { address: '0x3E58b7Ccd980d24Bd04b44Dca656a2e2941b2227', amount: 0.5 }]
    // return data;
};


