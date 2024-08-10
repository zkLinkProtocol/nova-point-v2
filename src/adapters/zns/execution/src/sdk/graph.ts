import { GraphResponse } from "./types";

class GraphQLHelper {
    /**
     * 
     * @param ms 
     * @returns {Promise} timeout
     */
    static delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

    /**
     * 
     * @param {String} query
     * @returns {Promise<GraphResponse>}
     */
    static fetchGraphQLData = async (endpooint: string, query: string): Promise<GraphResponse> => {
        let response;
        let data;
        let retry = true;
    
        while (retry) {
            try {
                response = await fetch(endpooint, {
                    method: "POST",
                    body: JSON.stringify({ query }),
                    headers: { "Content-Type": "application/json" },
                });
    
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
    
                data = await response.json();
                if (data.errors) {
                    throw new Error(`GraphQL error: ${JSON.stringify(data.errors)}`);
                }
    
                retry = false;
            } catch (error) {
                console.error("Fetch error:", error);
                console.log("Retrying in 5 seconds...");
                await this.delay(5000);
            }
        }
    
        return data.data as GraphResponse;
    };
    
}

export default GraphQLHelper