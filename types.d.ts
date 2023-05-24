interface Config {
	/**
     * path to cloud file or local files; gcs:// URIs are supported
     */
    filePath: string;
    /**
     * region for data residency
     */
    region: "US" | "EU";
    /**
     * mixpanel project
     */
    project: number | string;
    /**
     * mixpanel token
     */
    token: string;
    /**
     * mixpanel secret
     */
    secret: string;
    /**
     * job name (cloud only)
     */
    name: string;
    /**
     * job id (cloud only)
     */
    id: string;
    /**
     * streaming watermark
     */
	type: 'event' | 'user' | 'group' | 'identity';
	/**
	 * use verbose logging (for local runs only)
	 */
	verbose?: boolean;
	/**
	 * delete files after processing (for local runs only)
	 */
	cleanup?: boolean;
}


