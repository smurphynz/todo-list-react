#!/usr/bin/env python3
"""Scrape legal job vacancies and export to CSV."""

import csv
import json
import re
from urllib.parse import urljoin

import requests


USER_AGENT = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/124.0.0.0 Safari/537.36"
)


class LegalJobScraper:
    """Scrape jobs from target law firms and export results."""

    def __init__(self):
        self.session = requests.Session()
        self.session.headers.update({"User-Agent": USER_AGENT})

    def classify_role(self, title):
        """Classify role titles into practice areas with strict priority."""
        if not title:
            return "General Legal"

        title_lower = title.lower()

        # Priority 1: Non-Legal Filter (Kill List)
        non_legal_terms = [
            "assistant",
            "secretary",
            "hr",
            "finance",
            "it",
            "marketing",
            "business development",
            "reception",
            "paralegal",
        ]
        if any(term in title_lower for term in non_legal_terms):
            return "Non Legal / Business Services"

        # Priority 2: Disambiguation (The Traps)
        insurance_terms = ["liability", "insurance", "workers comp", "injury"]
        if any(term in title_lower for term in insurance_terms):
            return "Insurance"

        employment_terms = ["workplace", "safety", "industrial relations"]
        if any(term in title_lower for term in employment_terms):
            return "Employment & Safety"

        # Priority 3: Core Practice Areas
        property_terms = ["property", "real estate", "leasing"]
        if any(term in title_lower for term in property_terms):
            return "Property"

        construction_terms = ["construction", "projects", "infrastructure"]
        if any(term in title_lower for term in construction_terms):
            return "Construction"

        corporate_terms = ["m&a", "corporate", "private equity"]
        if any(term in title_lower for term in corporate_terms):
            return "Corporate"

        banking_terms = ["banking", "finance", "insolvency"]
        if any(term in title_lower for term in banking_terms):
            return "Banking & Finance"

        litigation_terms = ["dispute", "litigation"]
        if any(term in title_lower for term in litigation_terms):
            return "Litigation"

        # Priority 4: General Legal
        general_terms = ["lawyer", "associate", "counsel"]
        if any(term in title_lower for term in general_terms):
            return "General Legal"

        return "General Legal"

    def _post_workday_jobs(self, url, firm_name):
        """Fetch job postings from a Workday JSON API endpoint."""
        payload = {"appliedFacets": {}, "limit": 20, "offset": 0, "searchText": ""}
        jobs = []
        try:
            response = self.session.post(url, json=payload, timeout=30)
            response.raise_for_status()
            data = response.json()
        except (requests.RequestException, json.JSONDecodeError) as exc:
            print(f"Error fetching {firm_name} jobs: {exc}")
            return jobs

        postings = data.get("jobPostings") or data.get("data", {}).get("jobPostings")
        if not postings:
            return jobs

        for posting in postings:
            title = posting.get("title") or posting.get("jobTitle") or ""
            location = posting.get("location") or ""
            posted_date = posting.get("postedOn") or posting.get("postedDate") or ""
            link = posting.get("externalPath") or posting.get("applyUrl") or ""
            if link and not link.startswith("http"):
                link = urljoin(url, link)

            jobs.append(
                {
                    "Firm": firm_name,
                    "Role Title": title,
                    "Practice Area": self.classify_role(title),
                    "Location": location,
                    "Posted Date": posted_date,
                    "Link": link,
                }
            )

        return jobs

    def _extract_job_links(self, html, base_url):
        """Extract job links with AdvertID from HTML."""
        jobs = []
        anchor_pattern = re.compile(
            r'<a[^>]+href=["\'](?P<href>[^"\']*AdvertID=[^"\']*)["\'][^>]*>(?P<title>.*?)</a>',
            re.IGNORECASE | re.DOTALL,
        )
        for match in anchor_pattern.finditer(html):
            href = match.group("href").strip()
            title = re.sub(r"\s+", " ", re.sub(r"<.*?>", "", match.group("title")).strip())
            if not title:
                title = "Unknown"
            link = urljoin(base_url, href)
            jobs.append({"title": title, "link": link})
        return jobs

    def _find_fallback_link(self, html, base_url):
        """Find a fallback link for Current Opportunities or Search."""
        link_pattern = re.compile(
            r'<a[^>]+href=["\'](?P<href>[^"\']+)["\'][^>]*>(?P<label>.*?)</a>',
            re.IGNORECASE | re.DOTALL,
        )
        for match in link_pattern.finditer(html):
            label = re.sub(r"\s+", " ", re.sub(r"<.*?>", "", match.group("label")).strip())
            if re.search(r"current opportunities|search", label, re.IGNORECASE):
                return urljoin(base_url, match.group("href"))
        return None

    def _fetch_bigredsky_jobs(self):
        """Fetch jobs from Hall & Wilcox BigRedSky portal."""
        base_url = "https://hallandwilcox.bigredsky.com/"
        landing_page = urljoin(base_url, "page.php")
        jobs = []
        try:
            response = self.session.get(landing_page, timeout=30)
            response.raise_for_status()
        except requests.RequestException as exc:
            print(f"Error fetching Hall & Wilcox landing page: {exc}")
            return jobs

        html = response.text
        job_links = self._extract_job_links(html, base_url)

        if not job_links:
            fallback_url = self._find_fallback_link(html, base_url)
            if fallback_url:
                try:
                    fallback_response = self.session.get(fallback_url, timeout=30)
                    fallback_response.raise_for_status()
                    job_links = self._extract_job_links(
                        fallback_response.text, base_url
                    )
                except requests.RequestException as exc:
                    print(f"Error fetching Hall & Wilcox fallback page: {exc}")

        for job in job_links:
            title = job.get("title", "")
            jobs.append(
                {
                    "Firm": "Hall & Wilcox",
                    "Role Title": title,
                    "Practice Area": self.classify_role(title),
                    "Location": "",
                    "Posted Date": "",
                    "Link": job.get("link", ""),
                }
            )

        return jobs

    def scrape_all(self):
        """Scrape all firms and return aggregated job listings."""
        all_jobs = []
        all_jobs.extend(
            self._post_workday_jobs(
                "https://allens.wd3.myworkdayjobs.com/wday/cxs/Allens/Allens/jobs",
                "Allens",
            )
        )
        all_jobs.extend(
            self._post_workday_jobs(
                "https://claytonutz.wd3.myworkdayjobs.com/wday/cxs/Claytonutz1/Claytonutz1/jobs",
                "Clayton Utz",
            )
        )
        all_jobs.extend(self._fetch_bigredsky_jobs())
        return all_jobs

    def export_csv(self, jobs, filename="legal_jobs_export.csv"):
        """Export job listings to a CSV file."""
        fieldnames = [
            "Firm",
            "Role Title",
            "Practice Area",
            "Location",
            "Posted Date",
            "Link",
        ]
        try:
            with open(filename, "w", newline="", encoding="utf-8") as csvfile:
                writer = csv.DictWriter(csvfile, fieldnames=fieldnames)
                writer.writeheader()
                for job in jobs:
                    writer.writerow(job)
        except OSError as exc:
            print(f"Error writing CSV file: {exc}")


def main():
    scraper = LegalJobScraper()
    jobs = scraper.scrape_all()
    scraper.export_csv(jobs)
    print(f"Exported {len(jobs)} jobs to legal_jobs_export.csv")


if __name__ == "__main__":
    main()
